import { useState } from "react"
import { PlusIcon } from "/components/Icons/Icons"
import { XIcon } from "../../../components/Icons/Icons"

export const AddEventButton = ({ showModal, setShowModal }) => {

    return (
        <button 
            className="btn primary-btn"
            onClick={() => setShowModal(!showModal)}
        >
            {showModal ? (
                <>
                    <span>Close</span>
                    <XIcon />
                </>
            ) : (
                <>
                    <span>Add Event</span>
                    <PlusIcon />
                </>
            )}
        </button>
    )
}