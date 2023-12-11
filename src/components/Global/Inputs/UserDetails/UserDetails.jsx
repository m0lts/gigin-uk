export const DefaultNameInput = ({ nameData, setNameData }) => {

    const handleNameChange = (event) => {
        const { name, value } = event.target;
        setNameData({
            ...nameData,
            [name]: value
        })
    }

    return (
        <div className='user-name-cont'>
            <label htmlFor='first-name'>First Name:</label>
            <input
                type='text' 
                className='user-name-input' 
                id='first-name' 
                name='firstName' 
                required
                value={nameData.firstName}
                onChange={handleNameChange}
            />
            <label htmlFor='second-name'>Second Name:</label>
            <input
                type='text' 
                className='user-name-input' 
                id='second-name' 
                name='secondName' 
                required
                value={nameData.secondName}
                onChange={handleNameChange}
            />
        </div>
    )
}

export const DefaultPhoneNumberInput = ({ phoneNumberData, setPhoneNumberData }) => {
    const handleNumberChange = (event) => {
        setPhoneNumberData(event.target.value)
    }

    return (
        <div className='user-name-cont'>
            <label htmlFor='phone-number'>Phone Number:</label>
            <input
                type='tel' 
                className='phone-number-input' 
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
        <div className='address-cont'>
            <label htmlFor='line1'>Address Line 1:</label>
            <input
                type='text' 
                className='address-input' 
                id='line1' 
                name='line1' 
                required
                value={addressData.line1}
                onChange={handleAddressChange}
            />
            <label htmlFor='city'>City:</label>
            <input
                type='text' 
                className='address-input' 
                id='city' 
                name='city' 
                required
                value={addressData.city}
                onChange={handleAddressChange}
            />
            <label htmlFor='post-code'>Postcode:</label>
            <input
                type='text' 
                className='address-input' 
                id='post-code' 
                name='postCode' 
                required
                value={addressData.postCode}
                onChange={handleAddressChange}
            />
            <label htmlFor='country'>Country:</label>
            <input
                type='text' 
                className='address-input' 
                id='country' 
                name='country' 
                required
                value={addressData.country}
                onChange={handleAddressChange}
            />
        </div>
    )
}