import { useState, useEffect } from "react";
import { ClubIcon, MicrophoneIcon } from "../../../../components/ui/Icons/Icons";

export const GigExtraDetails = ({ formData, handleInputChange }) => {
    
    const handleExtraInfoChange = (info) => {
        handleInputChange({
            extraInformation: info,
        })
    }

    return (
        <>
            <div className="head">
                <h1 className="title">Any additional details?</h1>
                <p className="text">Is there anything else you’d like the musicians to know? </p>
            </div>
            <div className="body extra-details">
                <div className="input-group">
                    <textarea 
                        name="extraInformation" 
                        id="extraInformation" 
                        cols="30" 
                        rows="10"
                        onChange={(e) => handleExtraInfoChange(e.target.value)}
                        value={formData.extraInformation}
                        placeholder="Special requests, extra detail on what kind of experience you’re after..."
                    ></textarea>
                </div>
            </div>
        </>
    );
};