import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import './calendar.styles.css'

export const Calendar = ({ dateSelected, setDateSelected}) => {

    const handleDateClick = (arg) => {
        setDateSelected(arg.dateStr);
        arg.dayEl.style.color = '#FD6A00';
        arg.dayEl.style.fontWeight = 500;
    }

    return (
        <FullCalendar
            plugins={[ dayGridPlugin, interactionPlugin ]}
            initialView="dayGridMonth"
            dateClick={handleDateClick}
        />
    )
}