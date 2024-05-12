import { useState } from "react";
import './modals.styles.css';

export const AuthModal = ({ setUser }) => {

    const [authValues, setAuthValues] = useState({
        email: '',
        password: ''
    })

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setAuthValues(prev => ({ ...prev, [name]: value }));
    }

    const handleUserAuth = async (event) => {
        event.preventDefault();

        try {
            const response = await fetch('/api/auth/handleLogin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(authValues)
            });
            
            const responseData = await response.json();
            if (response.ok) {
                setUser(responseData.user);
            }

        } catch (error) {
            console.error(error)
        }

    }

    return (
        <div className="modal auth">
            <div className="modal-content">
                <form onSubmit={handleUserAuth}>
                    <div className="input-group">
                        <label htmlFor="email">Email:</label>
                        <input type="text" name="email" id="email" onChange={(e) => handleInputChange(e)} value={authValues.email} />
                    </div>
                    <div className="input-group">
                        <label htmlFor="email">Password:</label>
                        <input type="password" name="password" id="password" onChange={(e) => handleInputChange(e)} value={authValues.password} />
                    </div>
                    <button type="submit">Submit</button>
                </form>
            </div>
        </div>
    )
}