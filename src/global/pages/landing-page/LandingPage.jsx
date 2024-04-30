import { useState } from "react";
import { useNavigate } from "react-router-dom";

export const LandingPage = () => {

    const [password, setPassword] = useState("");
    const [allowEntry, setAllowEntry] = useState(false);

    const navigate = useNavigate();

    const handleFormSubmission = async (event) => {
        event.preventDefault();
        try {
            const response = await fetch("/api/passwordEntry", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ password })
            });

            if (response.ok) {
                setAllowEntry(true);
            } else {
                navigate("/");
            }
        } catch (error) {
            console.log(error);
        }
    }

    return (
        <div>
            {allowEntry ? (
                <>
                    <h1>Landing Page</h1>
                    <h2>Welcome Tom or Toby!</h2>
                </>
            ) : (
                <form onSubmit={handleFormSubmission}>
                    <div className="input-group">
                        <label htmlFor="password">Password:</label>
                        <input type="password" name="password" id="password" onChange={(event) => setPassword(event.target.value)} />
                    </div>
                    <button type="submit">Enter</button>
                </form>
            )}
        </div>
    )
}