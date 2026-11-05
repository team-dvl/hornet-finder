import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-bootstrap';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import type { EventDropArg, EventInput, EventSourceFuncArg } from '@fullcalendar/core';
import { hiveErrorOf } from '../../utils/hivesApi';
import { refreshPending } from '../../utils/pending';
import { fetchVisits, plannedWhen, updateVisit, visitLabel, type Visit } from '../../utils/visitsApi';

interface VisitCalendarProps {
  /** Only the visits of this apiary */
  apiaryId?: number;
  /** Bumped by the page after a change: the calendar reads its visits again */
  version: number;
  onOpen: (visitId: string) => void;
  /** A tap on a day: `day` is YYYY-MM-DD; a past day records, a day to come plans */
  onDay: (day: string, past: boolean) => void;
}

const pad = (value: number) => String(value).padStart(2, '0');
const dayOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Every visit between two local days (the calendar asks for the weeks it shows). */
async function visitsBetween(from: string, to: string, apiaryId?: number): Promise<Visit[]> {
  const found: Visit[] = [];
  for (let page = 1; page < 20; page += 1) {
    const result = await fetchVisits({ status: 'all', from, to, page, page_size: 100, ...(apiaryId ? { apiary: apiaryId } : {}) });
    found.push(...result.results);
    if (!result.next) break;
  }
  return found;
}

function eventOf(visit: Visit): EventInput {
  const when = plannedWhen(visit);
  const start = new Date(visit.started_at);
  const minutes = visit.duration_minutes ?? 60;
  const planned = visit.status === 'planned';
  return {
    id: visit.id,
    title: visitLabel(visit),
    start,
    end: new Date(start.getTime() + minutes * 60_000),
    classNames: ['visit-event', planned ? (when === 'late' ? 'visit-event-late' : 'visit-event-planned') : 'visit-event-done'],
    // A planned visit moves by a long press and a drag; one that took place stays
    startEditable: planned && Boolean(visit.permissions?.edit),
    durationEditable: false,
  };
}

/**
 * The visits in a calendar (FullCalendar): a month to see where they fall, a
 * list for the details on a phone. Planned visits stand out, late ones in red;
 * a long press drags a planned one to another day (it keeps its hour).
 */
export default function VisitCalendar({ apiaryId, version, onOpen, onDay }: VisitCalendarProps) {
  const calendar = useRef<FullCalendar | null>(null);
  const [error, setError] = useState<string | null>(null);

  // After a change elsewhere (a visit saved, done, deleted): read again
  useEffect(() => {
    calendar.current?.getApi().refetchEvents();
  }, [version, apiaryId]);

  const load = (info: EventSourceFuncArg, success: (events: EventInput[]) => void, failure: (error: Error) => void) => {
    // `end` is exclusive: the last day shown is the one before
    const last = new Date(info.end.getTime() - 86_400_000);
    visitsBetween(dayOf(info.start), dayOf(last), apiaryId)
      .then((visits) => { setError(null); success(visits.map(eventOf)); })
      .catch((loadError) => { setError(hiveErrorOf(loadError)); failure(loadError as Error); });
  };

  const moved = async (drop: EventDropArg) => {
    if (!drop.event.start) return drop.revert();
    try {
      await updateVisit(drop.event.id, { started_at: drop.event.start.toISOString() });
      refreshPending();
      calendar.current?.getApi().refetchEvents();
    } catch (moveError) {
      drop.revert();
      setError(hiveErrorOf(moveError));
    }
  };

  const tapped = (click: DateClickArg) => {
    const today = dayOf(new Date());
    const day = dayOf(click.date);
    onDay(day, day < today);
  };

  return (
    <div className="visit-calendar">
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}
      <FullCalendar
        ref={calendar}
        plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
        locale={frLocale}
        initialView="dayGridMonth"
        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' }}
        buttonText={{ today: "Aujourd'hui", month: 'Mois', list: 'Liste' }}
        height="auto"
        fixedWeekCount={false}
        dayMaxEvents={2}
        eventDisplay="block"
        displayEventTime={false}
        views={{ listMonth: { displayEventTime: true } }}
        events={load}
        eventClick={(click) => { click.jsEvent.preventDefault(); onOpen(click.event.id); }}
        dateClick={tapped}
        eventDrop={(drop) => void moved(drop)}
        eventLongPressDelay={350}
        noEventsText="Aucune visite ce mois-ci."
      />
    </div>
  );
}
