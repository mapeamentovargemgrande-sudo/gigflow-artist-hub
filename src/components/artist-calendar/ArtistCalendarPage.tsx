import * as React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { CalendarEvent, CalendarStatus } from "@/lib/calendar-types";
import { statusLabel } from "@/lib/calendar-utils";
import { useOrg } from "@/providers/OrgProvider";
import { useCalendarEvents } from "@/hooks/useCrmQueries";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { MonthSummary } from "./MonthSummary";
import { DetailsPanel } from "./DetailsPanel";
import { EventDialog, type EventDialogResult } from "./EventDialog";
import { CalendarClock, Filter, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

function mapDbEventToUi(row: any): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    start: row.start_time,
    end: row.end_time ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    fee: row.fee ?? undefined,
    funnelStage: row.stage ?? undefined,
    contractStatus:
      row.contract_status === "pending"
        ? "Pendente"
        : row.contract_status === "signed"
          ? "Assinado"
          : row.contract_status === "canceled"
            ? "Cancelado"
            : undefined,
    notes: row.notes ?? undefined,
  };
}

function statusClass(status: CalendarEvent["status"]) {
  switch (status) {
    case "confirmed":
      return "bg-status-confirmed/14 border-status-confirmed/40";
    case "negotiation":
      return "bg-status-negotiation/14 border-status-negotiation/45";
    case "blocked":
      return "bg-status-blocked/14 border-status-blocked/45";
    case "hold":
      return "bg-status-hold/14 border-status-hold/45";
  }
}

function eventBg(status: CalendarEvent["status"]) {
  switch (status) {
    case "confirmed":
      return "hsl(var(--status-confirmed))";
    case "negotiation":
      return "hsl(var(--status-negotiation))";
    case "blocked":
      return "hsl(var(--status-blocked))";
    case "hold":
      return "hsl(var(--status-hold))";
  }
}

export function ArtistCalendarPage() {
  const { activeOrgId } = useOrg();
  const { data: dbEvents = [], isLoading } = useCalendarEvents(activeOrgId);
  const events = React.useMemo(() => dbEvents.map(mapDbEventToUi), [dbEvents]);
  const qc = useQueryClient();
  const [selected, setSelected] = React.useState<CalendarEvent | null>(null);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<"create" | "edit">("create");
  const [dialogDateISO, setDialogDateISO] = React.useState<string>(new Date().toISOString());
  const [dialogEvent, setDialogEvent] = React.useState<CalendarEvent | null>(null);

  const [statusFilter, setStatusFilter] = React.useState<CalendarStatus | "all">("all");
  const [referenceDate, setReferenceDate] = React.useState<Date>(new Date());

  const filteredEvents = React.useMemo(() => {
    if (statusFilter === "all") return events;
    if (statusFilter === "free") return [];
    return events.filter((e) => e.status === statusFilter);
  }, [events, statusFilter]);

  const calendarEvents: EventInput[] = React.useMemo(
    () =>
      filteredEvents.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        backgroundColor: eventBg(e.status),
        borderColor: eventBg(e.status),
        textColor: "hsl(var(--primary-foreground))",
        extendedProps: { status: e.status },
      })),
    [filteredEvents]
  );

  function openCreate(iso: string) {
    setDialogMode("create");
    setDialogDateISO(iso);
    setDialogEvent(null);
    setDialogOpen(true);
  }

  function openEdit(event: CalendarEvent) {
    setDialogMode("edit");
    setDialogEvent(event);
    setDialogDateISO(event.start);
    setDialogOpen(true);
  }

  function handleDateSelect(arg: DateSelectArg) {
    openCreate(arg.startStr);
  }

  function handleEventClick(arg: EventClickArg) {
    const ev = events.find((e) => e.id === arg.event.id) ?? null;
    setSelected(ev);
  }

  async function handleEventDrop(arg: EventDropArg) {
    const id = arg.event.id;
    const nextStart = arg.event.start?.toISOString();
    if (!nextStart) return;

    try {
      const { error } = await db.from("calendar_events").update({ start_time: nextStart }).eq("id", id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["calendar_events", activeOrgId] });
      if (selected?.id === id) setSelected((s) => (s ? { ...s, start: nextStart } : s));
    } catch (e: any) {
      toast("Não foi possível mover o evento", { description: e?.message ?? "" });
      arg.revert();
    }
  }

  async function handleDialogResult(result: EventDialogResult) {
    if (!activeOrgId) return;

    if (result.type === "save") {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        toast("Você precisa estar logado");
        return;
      }

      const payload = {
        id: result.event.id,
        organization_id: activeOrgId,
        status: result.event.status,
        title: result.event.title,
        start_time: result.event.start,
        end_time: result.event.end ?? null,
        city: result.event.city ?? null,
        state: result.event.state ?? null,
        fee: result.event.fee ?? null,
        stage: result.event.funnelStage ?? null,
        contract_status:
          result.event.contractStatus === "Pendente"
            ? "pending"
            : result.event.contractStatus === "Assinado"
              ? "signed"
              : result.event.contractStatus === "Cancelado"
                ? "canceled"
                : null,
        notes: result.event.notes ?? null,
        created_by: user.id,
      };

      const { error } = await db.from("calendar_events").upsert(payload, { onConflict: "id" });
      if (error) {
        toast("Não foi possível salvar", { description: error.message });
        return;
      }
      await qc.invalidateQueries({ queryKey: ["calendar_events", activeOrgId] });
      setSelected(result.event);
      return;
    }

    if (result.type === "delete") {
      const { error } = await db.from("calendar_events").delete().eq("id", result.id);
      if (error) {
        toast("Não foi possível remover", { description: error.message });
        return;
      }
      await qc.invalidateQueries({ queryKey: ["calendar_events", activeOrgId] });
      setSelected((s) => (s?.id === result.id ? null : s));
    }
  }

  // Signature moment: spotlight gradient follows pointer on the top summary.
  const heroRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const onMove = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const mx = ((ev.clientX - rect.left) / rect.width) * 100;
      const my = ((ev.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty("--mx", `${mx.toFixed(2)}%`);
      el.style.setProperty("--my", `${my.toFixed(2)}%`);
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-10">
        <div ref={heroRef} className="fade-up">
          <MonthSummary referenceDate={referenceDate} events={events} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card className="border bg-card/70 p-4 shadow-soft">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
                  <CalendarClock className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold tracking-tight">Calendário</div>
                  <div className="text-sm text-muted-foreground">Mês • Semana • Lista (com drag & drop)</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => openCreate(new Date().toISOString())} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo evento
                </Button>

                <Separator orientation="vertical" className="hidden h-8 md:block" />

                <div className="flex items-center gap-2 rounded-lg border bg-card/50 px-3 py-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm text-muted-foreground">Filtro:</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className={cn(
                      "bg-transparent text-sm font-medium outline-none",
                      "text-foreground"
                    )}
                  >
                    <option value="all">Todos</option>
                    <option value="negotiation">Negociação</option>
                    <option value="confirmed">Show fechado</option>
                    <option value="hold">Reserva técnica</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="mb-3 flex flex-wrap gap-2">
              {(["confirmed", "negotiation", "hold", "blocked"] as const).map((s) => (
                <Badge key={s} variant="outline" className={cn("border", statusClass(s))}>
                  {statusLabel(s)}
                </Badge>
              ))}
            </div>

            <div className="rounded-lg border bg-background/40 p-2">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek,listWeek",
                }}
                initialView="dayGridMonth"
                height="auto"
                locale={ptBrLocale}
                selectable
                selectMirror
                editable
                eventStartEditable
                eventDurationEditable={false}
                dayMaxEvents
                events={calendarEvents}
                select={handleDateSelect}
                eventClick={handleEventClick}
                eventDrop={handleEventDrop}
                datesSet={(arg) => setReferenceDate(arg.start)}
                eventClassNames={() => ["rounded-md", "border", "shadow-soft"]}
              />
            </div>
          </Card>

          <div className="flex flex-col gap-6">
            <DetailsPanel selected={selected} onEdit={() => (selected ? openEdit(selected) : null)} />

            <Card className="border bg-card/70 p-5 shadow-soft">
              <div className="text-sm font-semibold tracking-tight">Regras inteligentes (MVP)</div>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Bloqueia confirmação de show em data já fechada.</li>
                <li>Alerta quando há negociações concorrendo pelo mesmo dia.</li>
                <li>Sugere datas alternativas automaticamente em caso de conflito.</li>
              </ul>
            </Card>
          </div>
        </div>
      </main>

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        initialDateISO={dialogDateISO}
        initialEvent={dialogEvent}
        existingEvents={events}
        onResult={handleDialogResult}
      />
    </div>
  );
}
