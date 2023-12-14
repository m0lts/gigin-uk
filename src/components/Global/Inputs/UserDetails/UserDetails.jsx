export const DefaultNameInput = ({ nameData, setNameData }) => {

    const handleNameChange = (event) => {
        const { name, value } = event.target;
        setNameData({
            ...nameData,
            [name]: value
        })
    }

    return (
        <>
            <div className='input-cont'>
                <label htmlFor='first-name' className={`input-label ${nameData.firstName && 'active'}`}>First Name</label>
                <input
                    type='text' 
                    className='input' 
                    id='first-name' 
                    name='firstName' 
                    required
                    value={nameData.firstName}
                    onChange={handleNameChange}
                />
            </div>
            <div className='input-cont'>
                <label htmlFor='second-name' className={`input-label ${nameData.secondName && 'active'}`}>Second Name</label>
                <input
                    type='text' 
                    className='input' 
                    id='second-name' 
                    name='secondName' 
                    required
                    value={nameData.secondName}
                    onChange={handleNameChange}
                />
            </div>
        </>
    )
}

export const DefaultPhoneNumberInput = ({ phoneNumberData, setPhoneNumberData }) => {
    const handleNumberChange = (event) => {
        setPhoneNumberData(event.target.value)
    }

    return (
        <div className='input-cont'>
            <label htmlFor='phone-number' className={`input-label ${phoneNumberData && 'active'}`}>Phone Number</label>
            <input
                type='tel' 
                className='input' 
                id='phone-number' 
                name='phone-number' 
                required
                value={phoneNumberData}
                onChange={handleNumberChange}
            />
        </div>
    )
}

export const DefaultAddressInput = ({ addressData, setAddressData }) => {

    const handleAddressChange = (event) => {
        const { name, value } = event.target;
        setAddressData({
            ...addressData,
            [name]: value
        })
    }

    return (
        <>
            <div className='input-cont'>
                <label htmlFor='line1' className={`input-label ${addressData.line1 && 'active'}`}>Address Line 1</label>
                <input
                    type='text' 
                    className='input' 
                    id='line1' 
                    name='line1' 
                    required
                    value={addressData.line1}
                    onChange={handleAddressChange}
                />
            </div>
            <div className='input-cont'>
                <label htmlFor='city' className={`input-label ${addressData.city && 'active'}`}>City</label>
                <input
                    type='text' 
                    className='input' 
                    id='city' 
                    name='city' 
                    required
                    value={addressData.city}
                    onChange={handleAddressChange}
                />
            </div>
            <div className='input-cont'>
                <label htmlFor='post-code' className={`input-label ${addressData.postCode && 'active'}`}>Postcode</label>
                <input
                    type='text' 
                    className='input' 
                    id='post-code' 
                    name='postCode' 
                    required
                    value={addressData.postCode}
                    onChange={handleAddressChange}
                />
            </div>
            <div className='input-cont'>
                <label htmlFor='country' className={`input-label ${addressData.country && 'active'}`}>Country</label>
                <input
                    type='text' 
                    className='input' 
                    id='country' 
                    name='country' 
                    required
                    value={addressData.country}
                    onChange={handleAddressChange}
                />
            </div>
        </>
    )
}