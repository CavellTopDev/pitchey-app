import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Clock, MapPin, Users, Video, Calendar as CalendarIcon } from 'lucide-react';
import { API_URL } from '../config/api.config';

interface CalendarEvent {
  id: number;
  title: string;
  type: 'meeting' | 'call' | 'deadline' | 'presentation';
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  participants: string[];
  pitchId?: number;
  pitchTitle?: string;
  description?: string;
  isVirtual: boolean;
  meetingLink?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [currentDate, view]);

  const fetchEvents = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString();
      
      const response = await fetch(
        `${API_URL}/api/creator/calendar/events?start=${startDate}&end=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    
    return days;
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'meeting':
        return 'bg-blue-500';
      case 'call':
        return 'bg-green-500';
      case 'deadline':
        return 'bg-red-500';
      case 'presentation':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'meeting':
        return <Users className="w-3 h-3" />;
      case 'call':
        return <Video className="w-3 h-3" />;
      case 'deadline':
        return <Clock className="w-3 h-3" />;
      case 'presentation':
        return <CalendarIcon className="w-3 h-3" />;
      default:
        return <CalendarIcon className="w-3 h-3" />;
    }
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/creator/dashboard')}
                className="p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
                <p className="text-sm text-gray-500">Manage your meetings and deadlines</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                {(['month', 'week', 'day'] as const).map((viewType) => (
                  <button
                    key={viewType}
                    onClick={() => setView(viewType)}
                    className={`px-3 py-1 text-sm rounded-md transition capitalize ${
                      view === viewType
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {viewType}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setShowEventModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                <Plus className="w-4 h-4" />
                New Event
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-sm">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <h2 className="text-xl font-semibold text-gray-900">
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition"
            >
              Today
            </button>
          </div>

          {view === 'month' && (
            <div className="p-6">
              {/* Days Header */}
              <div className="grid grid-cols-7 gap-px mb-2">
                {DAYS.map((day) => (
                  <div key={day} className="py-2 text-center text-sm font-medium text-gray-500">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
                {getDaysInMonth(currentDate).map((date, index) => {
                  const dayEvents = getEventsForDate(date);
                  const isCurrentMonthDay = isCurrentMonth(date);
                  const isTodayDate = isToday(date);
                  
                  return (
                    <div
                      key={index}
                      onClick={() => setSelectedDate(date)}
                      className={`bg-white p-2 min-h-[120px] cursor-pointer hover:bg-gray-50 transition ${
                        !isCurrentMonthDay ? 'text-gray-400' : ''
                      }`}
                    >
                      <div className={`text-sm font-medium mb-1 ${
                        isTodayDate 
                          ? 'bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center' 
                          : ''
                      }`}>
                        {date.getDate()}
                      </div>
                      
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            className={`text-xs p-1 rounded text-white truncate ${getEventTypeColor(event.type)}`}
                            title={event.title}
                          >
                            <div className="flex items-center gap-1">
                              {getEventTypeIcon(event.type)}
                              <span className="truncate">{event.title}</span>
                            </div>
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-gray-500 text-center">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'week' && (
            <div className="p-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <CalendarIcon className="w-12 h-12 text-blue-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Week View</h3>
                <p className="text-blue-800 mb-4">
                  The weekly calendar view is currently being developed. This will provide a detailed 
                  7-day layout with hourly time slots for better scheduling.
                </p>
                <button
                  onClick={() => setView('month')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Switch to Month View
                </button>
              </div>
            </div>
          )}

          {view === 'day' && (
            <div className="p-6">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 text-center">
                <Clock className="w-12 h-12 text-purple-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-purple-900 mb-2">Day View</h3>
                <p className="text-purple-800 mb-4">
                  The daily calendar view is in development. This will show a detailed hourly breakdown 
                  of your schedule for focused day planning.
                </p>
                <button
                  onClick={() => setView('month')}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  Switch to Month View
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Today's Events Sidebar */}
        <div className="mt-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedDate 
                ? `Events for ${selectedDate.toLocaleDateString()}`
                : 'Today\'s Events'
              }
            </h3>
            
            {(() => {
              const displayDate = selectedDate || new Date();
              const dayEvents = getEventsForDate(displayDate);
              
              return dayEvents.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No events scheduled</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dayEvents.map((event) => (
                    <div key={event.id} className="border rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded text-white ${getEventTypeColor(event.type)}`}>
                            {getEventTypeIcon(event.type)}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{event.title}</h4>
                            <p className="text-sm text-gray-500">
                              {formatTime(event.startTime)} - {formatTime(event.endTime)}
                            </p>
                          </div>
                        </div>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded capitalize">
                          {event.type}
                        </span>
                      </div>
                      
                      {event.pitchTitle && (
                        <p className="text-sm text-purple-600 mb-2">Re: {event.pitchTitle}</p>
                      )}
                      
                      {event.description && (
                        <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {event.isVirtual ? (
                          <div className="flex items-center gap-1">
                            <Video className="w-4 h-4" />
                            <span>Virtual Meeting</span>
                          </div>
                        ) : event.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{event.location}</span>
                          </div>
                        )}
                        
                        {event.participants.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{event.participants.length} participants</span>
                          </div>
                        )}
                      </div>
                      
                      {event.meetingLink && (
                        <div className="mt-3">
                          <a
                            href={event.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm"
                          >
                            <Video className="w-4 h-4" />
                            Join Meeting
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Event</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-900 mb-1">Event Creation Coming Soon</h4>
                  <p className="text-sm text-yellow-800">
                    We're working on a comprehensive event creation system that will allow you to:
                  </p>
                  <ul className="text-sm text-yellow-800 mt-2 space-y-1">
                    <li>• Schedule meetings with investors and creators</li>
                    <li>• Set deadlines for pitch submissions</li>
                    <li>• Create calendar reminders</li>
                    <li>• Integrate with external calendar systems</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowEventModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  alert('Coming Soon: Full event creation with calendar integration, meeting scheduling, and deadline management.');
                  setShowEventModal(false);
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                Get Notified
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}