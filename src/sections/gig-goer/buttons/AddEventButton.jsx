import { useState } from "react"
import { PlusIcon } from "/components/Icons/Icons"
import { XIcon } from "../../../components/Icons/Icons"

export const AddEventButton = ({ showModal, setShowModal }) => {

    return (
        <>
            {!showModal && (
                <button 
                    className="btn primary-btn"
                    onClick={() => setShowModal(!showModal)}
                >
                    <span>Add Event</span>
                    <PlusIcon />
                </button>
            )}
        </>
    )
}