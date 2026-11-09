package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// FaeStore shares durable UID admission and host backoff across clients.
type FaeStore struct{ db *sql.DB }

// NewFaeStore creates the local profile store on the migrated application database.
func NewFaeStore(db *sql.DB) *FaeStore { return &FaeStore{db: db} }

func (s *FaeStore) ReadProfile(ctx context.Context, uid string) (*domain.FaeProfile, error) {
	p := &domain.FaeProfile{UID: uid, Outcome: domain.FaeRefreshMissing}
	var current sql.NullString
	var history string
	var next int64
	err := s.db.QueryRowContext(ctx, `SELECT current_observation, history, refresh_available_at FROM fae_profiles WHERE uid = ?`, uid).Scan(&current, &history, &next)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	if err == nil {
		t := time.UnixMilli(next).UTC()
		p.RefreshAvailableAt = &t
		if current.Valid {
			if err := json.Unmarshal([]byte(current.String), &p.Current); err != nil {
				return nil, err
			}
		}
		if err := json.Unmarshal([]byte(history), &p.History); err != nil {
			return nil, err
		}
		if p.Current != nil {
			p.Outcome = domain.FaeRefreshSaved
		}
	}
	backoff, err := s.HostBackoff(ctx)
	if err != nil {
		return nil, err
	}
	if !backoff.IsZero() && (p.RefreshAvailableAt == nil || backoff.After(*p.RefreshAvailableAt)) {
		p.RefreshAvailableAt = &backoff
	}
	return p, nil
}

func (s *FaeStore) ReserveRefresh(ctx context.Context, uid string, now time.Time, interval time.Duration, capacity int) (domain.FaeRefreshAdmission, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.FaeRefreshAdmission{}, err
	}
	defer func() { _ = tx.Rollback() }()
	var backoff int64
	if err := tx.QueryRowContext(ctx, `SELECT backoff_until FROM fae_host_policy WHERE id=1`).Scan(&backoff); err != nil {
		return domain.FaeRefreshAdmission{}, err
	}
	if backoff > now.UnixMilli() {
		return domain.FaeRefreshAdmission{Outcome: domain.FaeRefreshBackoff, AvailableAt: time.UnixMilli(backoff).UTC()}, nil
	}
	var next int64
	err = tx.QueryRowContext(ctx, `SELECT refresh_available_at FROM fae_profiles WHERE uid=?`, uid).Scan(&next)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return domain.FaeRefreshAdmission{}, err
	}
	if err == nil && next > now.UnixMilli() {
		return domain.FaeRefreshAdmission{Outcome: domain.FaeRefreshCooldown, AvailableAt: time.UnixMilli(next).UTC()}, nil
	}
	if errors.Is(err, sql.ErrNoRows) {
		var count int
		if err := tx.QueryRowContext(ctx, `SELECT count(*) FROM fae_profiles`).Scan(&count); err != nil {
			return domain.FaeRefreshAdmission{}, err
		}
		if count >= capacity {
			res, err := tx.ExecContext(ctx, `DELETE FROM fae_profiles WHERE uid IN (SELECT uid FROM fae_profiles WHERE refresh_available_at <= ? ORDER BY updated_at, uid LIMIT ?)`, now.UnixMilli(), count-capacity+1)
			if err != nil {
				return domain.FaeRefreshAdmission{}, err
			}
			n, err := res.RowsAffected()
			if err != nil {
				return domain.FaeRefreshAdmission{}, err
			}
			if n < int64(count-capacity+1) {
				var earliest int64
				if err := tx.QueryRowContext(ctx, `SELECT min(refresh_available_at) FROM fae_profiles WHERE refresh_available_at > ?`, now.UnixMilli()).Scan(&earliest); err != nil {
					return domain.FaeRefreshAdmission{}, err
				}
				return domain.FaeRefreshAdmission{Outcome: domain.FaeRefreshCapacity, AvailableAt: time.UnixMilli(earliest).UTC()}, nil
			}
		}
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO fae_profiles(uid,refresh_available_at,updated_at) VALUES(?,?,?) ON CONFLICT(uid) DO UPDATE SET refresh_available_at=excluded.refresh_available_at`, uid, now.Add(interval).UnixMilli(), now.UnixMilli()); err != nil {
		return domain.FaeRefreshAdmission{}, err
	}
	if err := tx.Commit(); err != nil {
		return domain.FaeRefreshAdmission{}, err
	}
	return domain.FaeRefreshAdmission{Outcome: domain.FaeRefreshUpdated, AvailableAt: time.UnixMilli(now.Add(interval).UnixMilli()).UTC()}, nil
}

func (s *FaeStore) SaveObservation(ctx context.Context, uid string, observation domain.FaeObservation) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	var current sql.NullString
	var historyJSON string
	if err := tx.QueryRowContext(ctx, `SELECT current_observation,history FROM fae_profiles WHERE uid=?`, uid).Scan(&current, &historyJSON); err != nil {
		return err
	}
	var previous *domain.FaeObservation
	var history []domain.FaeObservation
	if current.Valid {
		if err := json.Unmarshal([]byte(current.String), &previous); err != nil {
			return err
		}
	}
	if err := json.Unmarshal([]byte(historyJSON), &history); err != nil {
		return err
	}
	if previous != nil && !domain.SameFaeRatings(previous, &observation) {
		distinct := []domain.FaeObservation{*previous}
		for _, old := range history {
			if !domain.SameFaeRatings(&old, &observation) && !domain.SameFaeRatings(&old, previous) {
				distinct = append(distinct, old)
			}
			if len(distinct) == 2 {
				break
			}
		}
		history = distinct
	}
	data, err := json.Marshal(observation)
	if err != nil {
		return err
	}
	old, err := json.Marshal(history)
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE fae_profiles SET current_observation=?,history=?,updated_at=? WHERE uid=?`, string(data), string(old), observation.ObservedAt.UnixMilli(), uid); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *FaeStore) HostBackoff(ctx context.Context) (time.Time, error) {
	var until int64
	if err := s.db.QueryRowContext(ctx, `SELECT backoff_until FROM fae_host_policy WHERE id=1`).Scan(&until); err != nil {
		return time.Time{}, err
	}
	if until == 0 {
		return time.Time{}, nil
	}
	return time.UnixMilli(until).UTC(), nil
}

func (s *FaeStore) ExtendHostBackoff(ctx context.Context, until time.Time) error {
	_, err := s.db.ExecContext(ctx, `UPDATE fae_host_policy SET backoff_until=max(backoff_until,?) WHERE id=1`, until.UnixMilli())
	return err
}
