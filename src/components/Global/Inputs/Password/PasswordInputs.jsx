import { useState } from "react"

export const DefaultPasswordInput = ({ passwordData, setPasswordData, passwordError, setPasswordError }) => {

    const handlePasswordChange = (event) => {
        setPasswordData(event.target.value);
        setPasswordError('');
    }


    return (
        <div className="password-cont">
            <label htmlFor="password">Password:</label>
            <input
                type="password" 
                className='password-input' 
                id="password" 
                name="password" 
                required
                onChange={handlePasswordChange}
            />
            {passwordError && (
                <p>{passwordError}</p>
            )}
        </div>
    )
}