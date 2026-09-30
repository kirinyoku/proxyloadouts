import { describe, it, expect } from 'vitest'
import {
  isHighlightProp,
  isDiscSubStatRecommended,
  getPropertyFamily,
} from './recommendations'

describe('recommendations', () => {
  describe('getPropertyFamily', () => {
    it('correctly maps standard property families by / 100', () => {
      expect(getPropertyFamily(11101)).toBe(111) // Base HP
      expect(getPropertyFamily(11102)).toBe(111) // HP%
      expect(getPropertyFamily(11103)).toBe(111) // Flat HP

      expect(getPropertyFamily(12101)).toBe(121) // Base ATK
      expect(getPropertyFamily(12102)).toBe(121) // ATK%
      expect(getPropertyFamily(12103)).toBe(121) // Flat ATK

      expect(getPropertyFamily(13101)).toBe(131) // Base DEF
      expect(getPropertyFamily(13102)).toBe(131) // DEF%
      expect(getPropertyFamily(13103)).toBe(131) // Flat DEF

      expect(getPropertyFamily(20101)).toBe(201) // Base Crit Rate
      expect(getPropertyFamily(20103)).toBe(201) // Crit Rate

      expect(getPropertyFamily(21101)).toBe(211) // Base Crit DMG
      expect(getPropertyFamily(21103)).toBe(211) // Crit DMG

      expect(getPropertyFamily(31201)).toBe(312) // Base Anomaly Proficiency
      expect(getPropertyFamily(31203)).toBe(312) // Anomaly Proficiency
    })

    it('separates PEN Ratio (231xx) and Flat PEN (232xx) into distinct families 231 and 232', () => {
      expect(getPropertyFamily(23101)).toBe(231) // Base PEN Ratio
      expect(getPropertyFamily(23103)).toBe(231) // PEN Ratio
      expect(getPropertyFamily(23201)).toBe(232) // Base PEN Flat
      expect(getPropertyFamily(23203)).toBe(232) // PEN Flat
    })
  })

  describe('isHighlightProp (Agent Profile Stats / AgentStatsPanel)', () => {
    it('returns false for missing propertyId or agentId without props', () => {
      expect(isHighlightProp(undefined, 1581)).toBe(false)
      expect(isHighlightProp(12101, undefined)).toBe(false)
      expect(isHighlightProp(12101, 999999)).toBe(false)
    })

    it('identifies profile highlight props for Ellen (1191)', () => {
      // Ellen HighlightProps: [12101 (Base ATK), 20101 (Base Crit Rate), 21101 (Base Crit DMG)]
      expect(isHighlightProp(12101, 1191)).toBe(true)
      expect(isHighlightProp(20101, 1191)).toBe(true)
      expect(isHighlightProp(21101, 1191)).toBe(true)
      expect(isHighlightProp(11101, 1191)).toBe(false)
      expect(isHighlightProp(13101, 1191)).toBe(false)
    })

    it('identifies profile highlight props for Rina (1211) and Claret (1611), excluding Flat PEN', () => {
      // Rina HighlightProps: [23101 (Base PEN Ratio)]
      expect(isHighlightProp(23101, 1211)).toBe(true) // PEN Ratio -> true
      expect(isHighlightProp(23201, 1211)).toBe(false) // Flat PEN -> false (NOT highlighted!)
      expect(isHighlightProp(12101, 1211)).toBe(false)

      // Claret HighlightProps: [13101 (DEF), 20101 (CRIT Rate), 21101 (CRIT DMG), 23101 (PEN Ratio)]
      expect(isHighlightProp(23101, 1611)).toBe(true) // PEN Ratio -> true
      expect(isHighlightProp(23201, 1611)).toBe(false) // Flat PEN -> false (NOT highlighted!)
    })

    it('prefers explicit highlightProps over agentId lookup when supplied', () => {
      const customProps = [13101] // Only DEF
      expect(isHighlightProp(13101, 1581, customProps)).toBe(true)
      expect(isHighlightProp(12101, 1581, customProps)).toBe(false)
    })
  })

  describe('isDiscSubStatRecommended (Drive Disc Sub-stats / DriveDiscGrid)', () => {
    it('returns false for missing propertyId or agentId without recommendations', () => {
      expect(isDiscSubStatRecommended(undefined, 1581)).toBe(false)
      expect(isDiscSubStatRecommended(12102, undefined)).toBe(false)
      expect(isDiscSubStatRecommended(12102, 999999)).toBe(false)
    })

    it('correctly handles Nangong Yu (1511): ATK% is recommended, Flat ATK is NOT', () => {
      // Nangong Yu: in-game screenshot proves ATK% is yellow, Flat ATK is white
      expect(isDiscSubStatRecommended(12102, 1511)).toBe(true) // ATK% -> yellow
      expect(isDiscSubStatRecommended(12103, 1511)).toBe(false) // Flat ATK -> white
      expect(isDiscSubStatRecommended(31201, 1511)).toBe(true) // Anomaly Proficiency -> yellow
      expect(isDiscSubStatRecommended(31203, 1511)).toBe(true)
      expect(isDiscSubStatRecommended(13101, 1511)).toBe(false) // Flat DEF -> white
    })

    it('correctly handles Remielle (1581): both ATK% and Flat ATK are recommended (special mechanic)', () => {
      // Remielle: in-game screenshot proves Flat ATK is yellow due to 4000+ ATK threshold mechanic
      expect(isDiscSubStatRecommended(12102, 1581)).toBe(true) // ATK% -> yellow
      expect(isDiscSubStatRecommended(12103, 1581)).toBe(true) // Flat ATK -> yellow
      expect(isDiscSubStatRecommended(31201, 1581)).toBe(true) // Anomaly Proficiency -> yellow
      expect(isDiscSubStatRecommended(11102, 1581)).toBe(false) // HP% -> white
      expect(isDiscSubStatRecommended(13103, 1581)).toBe(false) // Flat DEF -> white
    })

    it('correctly handles Rina (1211): Anomaly Proficiency and ATK% are recommended, Flat PEN and Flat ATK are NOT', () => {
      // Rina: on Drive Discs, Anomaly Proficiency and ATK% are recommended; Flat PEN and Flat ATK are NOT recommended
      expect(isDiscSubStatRecommended(31201, 1211)).toBe(true) // Anomaly Proficiency -> yellow
      expect(isDiscSubStatRecommended(31203, 1211)).toBe(true)
      expect(isDiscSubStatRecommended(12102, 1211)).toBe(true) // ATK% -> yellow
      expect(isDiscSubStatRecommended(12103, 1211)).toBe(false) // Flat ATK -> white
      expect(isDiscSubStatRecommended(23201, 1211)).toBe(false) // Flat PEN -> white
      expect(isDiscSubStatRecommended(23203, 1211)).toBe(false) // Flat PEN -> white
    })

    it('correctly handles Ellen (1191): CRIT Rate, CRIT DMG, ATK% recommended; Flat ATK is NOT', () => {
      expect(isDiscSubStatRecommended(20101, 1191)).toBe(true) // Crit Rate -> yellow
      expect(isDiscSubStatRecommended(20103, 1191)).toBe(true)
      expect(isDiscSubStatRecommended(21101, 1191)).toBe(true) // Crit DMG -> yellow
      expect(isDiscSubStatRecommended(21103, 1191)).toBe(true)
      expect(isDiscSubStatRecommended(12102, 1191)).toBe(true) // ATK% -> yellow
      expect(isDiscSubStatRecommended(12103, 1191)).toBe(false) // Flat ATK -> white
      expect(isDiscSubStatRecommended(11102, 1191)).toBe(false) // HP% -> white
    })

    it('prefers explicit recommendedSubStats over agentId lookup when supplied', () => {
      const customSubstats = [13102] // DEF% only
      expect(isDiscSubStatRecommended(13102, 1581, customSubstats)).toBe(true)
      expect(isDiscSubStatRecommended(12102, 1581, customSubstats)).toBe(false)
      expect(isDiscSubStatRecommended(12103, 1581, customSubstats)).toBe(false)
    })
  })
})
