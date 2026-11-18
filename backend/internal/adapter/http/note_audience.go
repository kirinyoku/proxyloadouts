package http

type noteAudience uint8

const (
	visitorNotes noteAudience = iota
	ownerNotes
)

func (a noteAudience) description(note *string, isNotePublic bool) *string {
	if a == ownerNotes || isNotePublic {
		return note
	}
	return nil
}
