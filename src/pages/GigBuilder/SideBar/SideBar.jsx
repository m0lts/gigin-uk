import { useEffect, useState } from 'react';
import { PostGigButton, SaveTemplateButton } from '/pages/GigBuilder/Buttons/GigBuilder.buttons'
import { formatSelectedDateLong } from '/utils/dateFormatting';
import { queryDatabase } from '/utils/queryDatabase';
import { GetInfoFromLocalStorage } from '/utils/updateLocalStorage';
import { LoadingSkeletonText } from '/components/Loading/LoadingEffects';
import './side-bar.styles.css'
import { DeleteTemplateButton } from '../Buttons/GigBuilder.buttons';

export const SideBar = ({ gigInformation, setGigInformation, postButtonAvailable, setPostButtonAvailable, setGigDate, setGigDetails, setGigProfile }) => {

    const [error, setError] = useState();

    // Save Template Logic
    const [nameTemplateModalOpen, setNameTemplateModalOpen] = useState(false);
    const [templateName, setTemplateName] = useState('');

    // Get templates from database on load
    const [templates, setTemplates] = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const userInfo = GetInfoFromLocalStorage();
    const userID = userInfo.userID;

    useEffect(() => {
        const getTemplates = async () => {
            const dataPayload = {
                userID: userID
            }
            try {
                const response = await queryDatabase('/api/GigBuilder/GetUserTemplates.js', dataPayload); 
                const responseData = await response.json();
                if (response.ok) {
                    setLoadingTemplates(false);
                    setTemplates(responseData.templates);
                } else {
                    setLoadingTemplates(false);
                    console.log('error');
                }
            } catch (error) {
                setLoadingTemplates(false);
                console.error('Error:', error);
            }
        }
        getTemplates();
    }, [userID])


    return (
        <aside className="side-bar">
            <div className="box">
                <div className="main">
                    <h3 className='subtitle'>Gig Information:</h3>
                    {!gigInformation.gigProfile && (
                        <p className='text'>Start by selecting the venue profile you want to build the gig for.</p>
                    )}
                    {gigInformation.gigProfile && (
                        <>
                            <p className='text'>Venue: {gigInformation.gigProfile.profileName}</p>
                            <p className='text'>Address: {gigInformation.gigProfile.hostAddress.address}</p>
                        </>
                    )}
                    {gigInformation.gigDate && (
                        <>
                            <p className='text'>Date: {formatSelectedDateLong(gigInformation.gigDate)}</p>
                        </>
                    )}
                    {gigInformation.gigDetails && (
                        <>
                            {gigInformation.gigDetails.musicianType && gigInformation.gigDetails.musicianType.length > 0 && (<p className='text'>Musician Type: {gigInformation.gigDetails.musicianType.map((type, index) => (<span key={index}>{type} </span>))}</p>)}
                            {gigInformation.gigDetails.musicType && (<p className='text'>Music Type: {gigInformation.gigDetails.musicType}</p>)}
                            {gigInformation.gigDetails.genres && gigInformation.gigDetails.genres.length > 0 && (<p className='text'>Genres: {gigInformation.gigDetails.genres.map((genre, index) => (<span key={index}>{genre} </span>))}</p>)}
                            {gigInformation.gigDetails.gigStartTime && (<p className='text'>Start Time: {gigInformation.gigDetails.gigStartTime}</p>)}
                            {gigInformation.gigDetails.gigDuration && (<p className='text'>Gig Duration: {gigInformation.gigDetails.gigDuration}</p>)}
                            {gigInformation.gigDetails.musicianArrivalTime && (<p className='text'>Musician Arrival Time: {gigInformation.gigDetails.musicianArrivalTime}</p>)}
                            {gigInformation.gigDetails.gigFee && (<p className='text'>Gig Fee: £{gigInformation.gigDetails.gigFee}</p>)}
                            {gigInformation.gigDetails.extraInformation && (<p className='text'>Extra Information: {gigInformation.gigDetails.extraInformation}</p>)}

                        </>
                    )}
                </div>
                <div className="foot">
                    {nameTemplateModalOpen ? (
                        <>
                            <div className="template-naming input-cont">
                                <label className="text" htmlFor='template-name'>Template name:</label>
                                <input 
                                    type="text" 
                                    className="input" 
                                    id='template-name' 
                                    value={templateName}
                                    onChange={(e) => { 
                                        setTemplateName(e.target.value); 
                                        setError('');
                                    }}
                                />
                            </div>
                            <div className="buttons">
                                <button className="btn white-button" onClick={() => setNameTemplateModalOpen(false)}>Cancel</button>
                                <SaveTemplateButton
                                    gigInformation={gigInformation}
                                    setNameTemplateModalOpen={setNameTemplateModalOpen}
                                    nameTemplateModalOpen={nameTemplateModalOpen}
                                    style='black-button'
                                    templateName={templateName}
                                    setTemplateName={setTemplateName}
                                    error={error}
                                    setError={setError}
                                    setTemplates={setTemplates}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="buttons">
                            <SaveTemplateButton
                                gigInformation={gigInformation}
                                setNameTemplateModalOpen={setNameTemplateModalOpen}
                                nameTemplateModalOpen={nameTemplateModalOpen}
                                style='white-button'
                            />
                            <PostGigButton
                                gigInformation={gigInformation}
                                postButtonAvailable={postButtonAvailable}
                                setPostButtonAvailable={setPostButtonAvailable}
                                error={error}
                                setError={setError}
                            />
                        </div>
                    )}
                </div>
                {error && (
                    <div className="error-container">
                        <p className='error'>{error}</p>
                    </div>
                )}
            </div>
            <div className="box">
                <div className="main">
                    <h3 className='subtitle'>Templates:</h3>
                    {loadingTemplates ? (
                        <LoadingSkeletonText
                            count={1}
                            height={75}
                        />
                    ) : (
                        templates.length === 0 ? (
                            <p className='text'>You don't have any templates yet.</p>
                        ) : (
                            <ul className="templates-list">
                                {templates.map((template, index) => (
                                    <li 
                                        key={index} 
                                        className="template"
                                        onClick={() => {
                                            setGigInformation(template); 
                                            setGigProfile(template.gigProfile); 
                                            setGigDate(template.gigDate); 
                                            setGigDetails(template.gigDetails)
                                        }}
                                    >
                                        <p className="text">{template.templateName}</p>
                                        <div className="buttons">
                                            <DeleteTemplateButton 
                                                template={template}
                                                userID={userID}
                                                setTemplates={setTemplates}
                                                setError={setError}
                                            />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )
                    )}
                </div>
            </div>
        </aside>
    )
}