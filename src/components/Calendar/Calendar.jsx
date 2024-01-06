import { useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import './calendar.styles.css'

export const Calendar = ({ dateSelected, setDateSelected}) => {

    const handleDateClick = (arg) => {
        if (dateSelected === arg.dateStr) {
            setDateSelected(null);
            arg.dayEl.style.color = '';
            arg.dayEl.style.fontWeight = '';
        } else {
            if (dateSelected) {
                const prevSelectedDateEl = document.querySelector(`[data-date="${dateSelected}"]`);
                if (prevSelectedDateEl) {
                    prevSelectedDateEl.style.color = '';
                    prevSelectedDateEl.style.fontWeight = '';
                }
            }
            setDateSelected(arg.dateStr);
            arg.dayEl.style.color = '#FD6A00';
            arg.dayEl.style.fontWeight = '500';
        }
    }

    // Ensure date that has been selected is styled correctly if the user closes and re-opens the calendar.
    useEffect(() => {
        const applyStyling = () => {
            const selectedDateEl = document.querySelector(`[data-date="${dateSelected}"]`);
            const allDateElements = document.querySelectorAll('.fc-daygrid-day');
            allDateElements.forEach((dateElement) => {
                dateElement.style.color = '';
                dateElement.style.fontWeight = '';
            });
            if (selectedDateEl) {
                selectedDateEl.style.color = '#FD6A00';
                selectedDateEl.style.fontWeight = '500';
            }
        };

        applyStyling();
    }, [dateSelected]);

    return (
        <FullCalendar
            plugins={[ dayGridPlugin, interactionPlugin ]}
            initialView="dayGridMonth"
            dateClick={handleDateClick}
        />
    )
}