import React, { useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useProjectScheduleEvents } from "../hooks/useProjectScheduleEvents";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, isToday } from "date-fns";

export const Calendar: React.FC = () => {
  const { tasks, currentUser, projects } = useAppContext();
  const { workspaceId } = useWorkspace();
  const [currentDate, setCurrentDate] = useState(new Date());
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects]);
  const { scheduleEventRows } = useProjectScheduleEvents(workspaceId, projectIds);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const daysInCalendar = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const myTasks = tasks.filter(t => t.assignees.includes(currentUser.id));

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Calendar</h1>
          <p className="text-gray-500 mt-1 font-medium">Keep track of your deadlines.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={goToToday} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 shadow-sm transition-colors">Today</button>
          <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <button onClick={prevMonth} className="px-3 py-2 text-gray-500 hover:bg-gray-50 hover:text-blue-600 transition-colors"><ChevronLeft size={18} className="stroke-[3px]" /></button>
            <div className="px-4 font-bold text-gray-700 min-w-[140px] text-center">{format(currentDate, "MMMM yyyy")}</div>
            <button onClick={nextMonth} className="px-3 py-2 text-gray-500 hover:bg-gray-50 hover:text-blue-600 transition-colors"><ChevronRight size={18} className="stroke-[3px]" /></button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
              {day}
            </div>
          ))}
        </div>
        
        <div className="flex-1 grid grid-cols-7 grid-rows-5 sm:grid-rows-auto">
          {daysInCalendar.map((day, idx) => {
            const dayTasks = myTasks.filter(t => isSameDay(new Date(t.dueDate), day));
            const dayScheduleEvents = scheduleEventRows.filter(({ event }) => isSameDay(new Date(event.eventDate), day));
            const dayItemCount = dayTasks.length + dayScheduleEvents.length;
            return (
              <div 
                key={day.toString()} 
                className={`min-h-[100px] border-b border-r border-gray-100 p-2 sm:p-3 transition-colors ${
                  !isSameMonth(day, currentDate) ? 'bg-gray-50/50 opacity-50' : ''
                } ${idx % 7 === 6 ? 'border-r-0' : ''}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold ${
                    isToday(day) ? 'bg-blue-600 text-white' : 'text-gray-600'
                  }`}>
                    {format(day, "d")}
                  </span>
                  {dayItemCount > 0 && (
                     <span className="text-[10px] font-semibold text-gray-400 under hidden sm:inline-block">{dayItemCount} item{dayItemCount === 1 ? "" : "s"}</span>
                  )}
                </div>
                
                <div className="space-y-1.5 overflow-y-auto max-h-[80px] sm:max-h-[none]">
                  {dayScheduleEvents.map(({ projectId, event }) => {
                    const project = projects.find(p => p.id === projectId);
                    return (
                      <div key={`event-${projectId}-${event.id}`} className="text-[10px] sm:text-xs leading-tight font-semibold bg-emerald-50 text-emerald-700 px-2 py-1.5 rounded-lg truncate cursor-pointer hover:bg-emerald-100 transition-colors" title={`${event.title} at ${format(new Date(event.eventDate), "h:mm a")} - ${project?.name}`}>
                        <span className="hidden sm:inline opacity-75 mr-1 font-semibold">{project?.name.substring(0, 3)}:</span>
                        <span className="opacity-75 mr-1">{format(new Date(event.eventDate), "h:mm a")}</span>
                        {event.title}
                      </div>
                    )
                  })}
                  {dayTasks.map(task => {
                    const project = projects.find(p => p.id === task.projectId);
                    return (
                      <div key={task.id} className="text-[10px] sm:text-xs leading-tight font-semibold bg-blue-50 text-blue-700 px-2 py-1.5 rounded-lg truncate cursor-pointer hover:bg-blue-100 transition-colors" title={`${task.title} - ${project?.name}`}>
                        <span className="hidden sm:inline opacity-75 mr-1 font-semibold">{project?.name.substring(0, 3)}:</span>
                        {task.title}
                      </div>
                    )
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
