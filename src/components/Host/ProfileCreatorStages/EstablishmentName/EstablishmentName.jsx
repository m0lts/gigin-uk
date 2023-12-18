export const EstablishmentName = ({ establishmentName, setEstablishmentName, establishmentType }) => {

    const handleInputChange = (event) => {
        setEstablishmentName(event.target.value);
    }

    return (
        <div className='establishment-name profile-creator-stage'>
            <h1 className='title'>What's the name of this {establishmentType}?</h1>
            <div className="input-cont">
                <input 
                    type="text"
                    id="establishmentName"
                    name="establishmentName"
                    className="text-input"
                    value={establishmentName}
                    onChange={handleInputChange}
                />
            </div>
        </div>
    )
}