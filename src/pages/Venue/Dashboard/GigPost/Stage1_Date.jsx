import { useState, useEffect } from "react"
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export const GigDate = ({ formData, handleInputChange }) => {
    const [selectedDate, setSelectedDate] = useState(formData.date || null);

    useEffect(() => {
        handleInputChange({ date: selectedDate });
    }, [selectedDate]);

    const handleCheckboxChange = (e) => {
        const isChecked = e.target.checked;
        handleInputChange({
            dateUndecided: isChecked,
            date: isChecked ? null : selectedDate,
        });
        if (isChecked) {
            setSelectedDate(null);
        }
    };

    useEffect(() => {
        if (formData.dateUndecided === true) {
            setSelectedDate(null);
        }
    }, [formData.dateUndecided])

    return (
        <>  
            <div className="head">
                <h1 className="title">When is the Gig?</h1>
            </div>
            <div className="body date">
                {/* <div className="toggle-container">
                    <label htmlFor="date-undecided">Date undecided?</label>
                    <label className="switch">
                        <input
                            type="checkbox"
                            id="date-undecided"
                            checked={formData.dateUndecided}
                            onChange={handleCheckboxChange}
                        />
                        <span className="slider round"></span>
                    </label>
                </div> */}
                <div className='calendar'>
                    {formData.dateUndecided && <div className="disable"></div>}
                    <DatePicker
                        selected={selectedDate}
                        onChange={(date) => setSelectedDate(date)}
                        inline
                    />
                </div>
            </div>
        </>
    );
};