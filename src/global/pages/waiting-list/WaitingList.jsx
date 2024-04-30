import { useState } from "react";
import { useNavigate } from "react-router-dom";

export const WaitingList = () => {

    const navigate = useNavigate();

    const [formValues, setFormValues] = useState({
        name: "",
        email: ""
    });

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setFormValues({
            ...formValues,
            [name]: value
        });
    }


    const handleFormSubmission = async (event) => {
        event.preventDefault();
        try {
            const response = await fetch("/api/waiting-list/postFormData", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(formValues)
            });

            if (response.status === 201) {
                navigate("/access");
            } else if (response.status === 200) {
                alert("User added to the waiting list");
            } else {
                alert("User already joined waiting list");
            }
        } catch (error) {
            console.log(error);
        }
    }

    return (
        <div>
            <h1>Waiting List</h1>
            <form>
                <div className="input-group">
                    <label htmlFor="name">Name:</label>
                    <input 
                        type="text" 
                        id="name" 
                        name="name"
                        onChange={(event) => handleInputChange(event)}
                    />
                </div>
                <div className="input-group">
                    <label htmlFor="email">Email Address:</label>
                    <input 
                        type="email" 
                        id="email" 
                        name="email"
                        onChange={(event) => handleInputChange(event)}
                    />
                </div>
                <button type="submit" onClick={handleFormSubmission}>Submit</button>
            </form>
        </div>
    );
    };