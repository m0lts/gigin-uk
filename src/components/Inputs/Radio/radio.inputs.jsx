import '/components/Inputs/Radio/radio.inputs.styles.css'


// USER TYPE INPUT
// /////////////////////////////////////////////////////////////////////////////
export const DefaultUserType = ({ userType = '', setUserType }) => {

    const handleRadioChange = (event) => {
        setUserType(event.target.value);
    }

    return (
        <div className='user-type-cont'>
            <p className='question'>I'm a:</p>
            <div className='flexbox'>
                <label htmlFor='musician' className={`label ${userType === 'musician' ? 'clicked' : ''}`}>
                    <input 
                        type='radio' 
                        id='musician' 
                        name='musician' 
                        value='musician' 
                        required
                        className='user-type-input'
                        checked={userType === 'musician'} 
                        onChange={handleRadioChange} 
                    />
                    Musician
                </label>
                <label htmlFor='host' className={`label ${userType === 'host' ? 'clicked' : ''}`}>
                    <input 
                        type='radio' 
                        id='host' 
                        name='host' 
                        value='host' 
                        required
                        className='user-type-input' 
                        checked={userType === 'host'} 
                        onChange={handleRadioChange} 
                    />
                    Host
                </label>
                <label htmlFor='gig-goer' className={`label ${userType === 'gig-goer' ? 'clicked' : ''}`}>
                    <input 
                        type='radio' 
                        id='gig-goer' 
                        name='gig-goer' 
                        value='gig-goer'
                        required
                        className='user-type-input' 
                        checked={userType === 'gig-goer'} 
                        onChange={handleRadioChange} 
                    />
                    Gig-goer
                </label>
            </div>
        </div>
    )
}