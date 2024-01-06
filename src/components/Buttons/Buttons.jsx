import { useNavigate } from "react-router-dom"
import { useRef, useEffect, useState } from "react"
import { MapIcon, MenuIcon, ListIcon, BookmarkIcon, SearchIcon, XIcon } from "/components/Icons/Icons"
import { queryDatabase } from "/utils/queryDatabase"
import { formatSelectedDate } from "/utils/dateFormatting"
import './buttons.styles.css'
import { LoadingDots } from "/components/Loading/LoadingEffects"
import { AddProfileCreatedToLocalStorage, AddProfileDataToLocalStorage, GetInfoFromLocalStorage } from "/utils/updateLocalStorage"

// *************************** //
// UNIVERSAL BUTTONS //
export const SearchButtonSmall = ({ clearItemOne, clearItemTwo }) => {

    const handleClearItems = () => {
        clearItemOne(null);
        clearItemTwo(null);
    }

    return (
        <button className='btn search-button-small' onClick={handleClearItems}>
            <SearchIcon />
        </button>
    )
}
export const SearchButtonBig = () => {
    return (
        <button className='btn search-button-big'>
            <span>Search</span>
            <SearchIcon />
        </button>
    )
}

export const EmptySubmitButton = () => {
    return (
        <button type="submit" className="next-footer-button btn">
            Submit
        </button>
    )
}




// *************************** //
// HEADER BUTTONS //

// Desktop header My Gigin button
// export const MyGiginButton = ({ setButtonClicked, buttonStatus, userName }) => {

//     // Show menu when buttonStatus is truthy and vice versa.
//     const handleShowMenu = () => {
//         setButtonClicked(!buttonStatus);
//     }
//     // Hide menu if user clicks anywhere on screen when menu is open
//     const buttonRef = useRef(null);
//     useEffect(() => {
//         const handleClickOutside = (event) => {
//             if (buttonRef.current && !buttonRef.current.contains(event.target)) {
//                 setButtonClicked(false);
//             }
//         };
//         document.addEventListener('click', handleClickOutside);
//         return () => {
//             document.removeEventListener('click', handleClickOutside);
//         };
//     }, [setButtonClicked]);

//     return (
//         <button 
//             ref={buttonRef}
//             className={`btn my-gigin-button ${buttonStatus ? 'active' : ''}`}
//             onClick={handleShowMenu}
//         >
//             {userName ? (
//                 <span className='text'>{userName}</span>
//             ) : (
//                 <span className='text'>My Gigin</span>
//             )}
//             <MenuIcon />
//         </button>
//     )
// }

// // Mobile header buttons
// export const MobileHeaderSavedButton = () => {
//     return (
//         <button className='btn header-saved-button-mobile'>
//             <BookmarkIcon />
//             <span>Saved</span>
//         </button>
//     )
// }
// export const MobileHeaderMyGiginButton = ({ setButtonClicked, buttonStatus, userName }) => {
//     // Show menu when buttonStatus is truthy and vice versa.
//     const handleShowMenu = () => {
//         setButtonClicked(!buttonStatus);
//     }
//     // Hide menu if user clicks anywhere on screen when menu is open
//     const buttonRef = useRef(null);
//     useEffect(() => {
//         const handleClickOutside = (event) => {
//             if (buttonRef.current && !buttonRef.current.contains(event.target)) {
//                 setButtonClicked(false);
//             }
//         };
//         document.addEventListener('click', handleClickOutside);
//         return () => {
//             document.removeEventListener('click', handleClickOutside);
//         };
//     }, [setButtonClicked]);

//     return (
//         <button 
//             ref={buttonRef}
//             className={`btn my-gigin-button-mobile ${buttonStatus ? 'active' : ''}`}
//             onClick={handleShowMenu}
//         >
//             <MenuIcon />
//             {userName ? (
//                 <span className='text'>{userName}</span>
//             ) : (
//                 <span className='text'>My Gigin</span>
//             )}
//         </button>
//     )
// }

// // Profile creator save and exit button
// export const SaveAndExitButton = ({ userProfile }) => {
    
//     const [isLoading, setIsLoading] = useState(false);
//     const userInfo = GetInfoFromLocalStorage();
//     const userID = userInfo.userID;

//     const navigate = useNavigate();

//     const handleSaveAndExit = async (event) => {
//         event.preventDefault();
//         setIsLoading(true);
//         const dataPayload = {
//             userID,
//             userProfile,
//         }
//         try {
//             const response = await queryDatabase('/api/Profile/SaveProfileEntry.js', dataPayload); 
//             const responseData = await response.json();
//             if (response.ok) {
//                 setIsLoading(false);
//                 AddProfileCreatedToLocalStorage(true);
//                 AddProfileDataToLocalStorage(responseData.updatedProfileDocument.profiles)
//                 navigate('/control-centre');
//             } else {
//                 setIsLoading(false);
//                 console.log('error');
//             }
//         } catch (error) {
//             console.error('Error:', error);
//         }
//     }

//     return (
//         <button 
//             className={`btn save-and-exit-button ${isLoading && 'loading'}`} 
//             onClick={handleSaveAndExit}
//         >
//             {isLoading ? (
//                 <LoadingDots />
//             ) : (
//                 <p>Save and Exit</p>
//             )}
//         </button>
//     )
// }


// *************************** //
// HOMEPAGE BUTTONS //

// Map and list view type toggle
// export const ChangeViewTypeButton = ({ showMap, setShowMap }) => {

//     const handleViewChange = () => {
//         if (showMap) {
//             setShowMap(false);
//         } else {
//             setShowMap(true);
//         }
//     }

//     return (
//         <button 
//             className='btn change-view-btn'
//             onClick={handleViewChange}
//         >
//             {showMap ? (
//                 <>
//                     <ListIcon />
//                     <span>List View</span>
//                 </>
//             ) : (
//                 <>
//                     <MapIcon />
//                     <span>Map View</span>
//                 </>
//             )}
//         </button>
//     )
// }


// *************************** //
// FILTER BUTTONS //

// // Universal filter button
// export const FilterButton = ({ filterName, showFilter, setShowFilter, filterFilled, setFilterFilled, otherFilter, setOtherFilter }) => {

//     const handleShowFilter = () => {
//         if (showFilter) {
//             setShowFilter(false);
//         } else {
//             setShowFilter(true);
//             setOtherFilter(false);
//         }
//     }

//     const handleClearFilter = () => {
//         setFilterFilled(false);
//     }

//     const isDate = (date) => {
//         return Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date.getTime());
//     };

//     return (
//         <button 
//             className={`btn filter-button ${showFilter && 'active'}`}
//             onClick={handleShowFilter}
//         >   
//             <span className={`filter-button-name ${filterFilled && 'filled'}`}>{filterName}</span>
//             {filterFilled && (
//                 // If filterFilled is a date, then return the date formatted to desire.
//                 // If not a date, just render fitlerFilled.
//                 <div className='filter-button-filled' onClick={handleClearFilter}>
//                     {isDate(new Date(filterFilled)) ? (
//                         formatSelectedDate(filterFilled)
//                     ) : (
//                         filterFilled
//                     )}
//                 </div>
//             )}
//         </button>
//     )
// }

// // *************************** //
// // APPLY FILTER BUTTON //
// export const ApplyFilterButton = ({ applyFilter }) => {

//     // See FilterBar save button for reference
//     const handleApply = () => {
//         applyFilter(false);
//     }

//     return (
//         <button 
//             className='btn apply-button'
//             onClick={handleApply}
//         >
//             Apply
//         </button>
//     )
// }


// *************************** //
// FORM BUTTONS //


export const NextButtonResetPassword = ({ dataPayload, apiRoute, setResponse }) => {

    const [isLoading, setIsLoading] = useState(false);

    const handleResetPassword = async (event) => {
        event.preventDefault();
        setIsLoading(true);
        try {
            const response = await queryDatabase(apiRoute, dataPayload);
            const responseData = await response.json();
            if (response.ok) {
                setIsLoading(false);
                setResponse({
                    data: responseData,
                    status: response.status
                })
            } else {
                setIsLoading(false);
                setResponse({
                    status: response.status,
                    message: responseData.error
                })
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    return (
        <button 
            className={`btn submit-button ${isLoading && 'loading'}`}
            onClick={handleResetPassword}
        >
            {isLoading ? (
                <LoadingDots />
            ) : (
                <p>Reset Password</p>
            )}
        </button>
    )
}

// Next button forgot password
export const NextButtonForgotPassword = ({ emailData, setEmailError, setShowPasswordSection, dataPayload, apiRoute }) => {

    const [isLoading, setIsLoading] = useState(false);

    const handleNext = async (event) => {
        setIsLoading(true);
        event.preventDefault();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailData)) {
            setEmailError('Please enter a valid email address. Example: johndoe@gmail.com');
        } else {
            try {
                const response = await queryDatabase(apiRoute, dataPayload);
                if (response.ok) {
                    setShowPasswordSection(true);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Error:', error);
                setIsLoading(false);
            }
        }
    }

    return (
        <button 
            className={`btn next-button ${isLoading && 'loading'}`}
            onClick={handleNext}
        >
            {isLoading ? (
                <LoadingDots />
            ) : (
                <p>Next</p>
            )}
        </button>
    )
}

// Submit button
export const SubmitFormButton = ({ passwordError, verifyPasswordStatus, dataPayload, apiRoute, setResponse, setPasswordError }) => {

    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setPasswordError('');
        const passwordPattern = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordPattern.test(dataPayload.userPassword)) {
            setPasswordError('Password must contain at least 8 characters, a capital letter and number.');
        } else {
            setIsLoading(true);
            try {
                const response = await queryDatabase(apiRoute, dataPayload);
                const responseData = await response.json();
                if (response.ok) {
                    setIsLoading(false);
                    setResponse({
                        data: responseData,
                        status: response.status
                    })
                } else {
                    setIsLoading(false);
                    setResponse({
                        status: response.status,
                        message: responseData.error
                    })
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
        
    }

    return (
        <button 
            className={`btn submit-button ${isLoading && 'loading'}`}
            onClick={handleSubmit}
        >
            {isLoading ? (
                <LoadingDots />
            ) : (
                <p>Submit</p>
            )}
        </button>
    )
}

// *************************** //
// OTHER BUTTONS //

export const SelectExistingNameButton = ({ userName, setProfileName }) => {

    const handleButtonClick = () => {
        setProfileName(userName);
    }

    return (
        <button 
            className="btn existing-name-button"
            onClick={handleButtonClick}
        >
            Use Account Name
        </button>
    )
}


// *************************** //
// FOOTER BUTTONS //

// Back and next footer buttons
export const BackFooterButton = ({ stageNumber, setStageNumber, setSaveButtonAvailable, setNextButtonAvailable }) => {

    const handleBackClick = () => {
        setStageNumber(stageNumber - 1);
        setSaveButtonAvailable(false);
        setNextButtonAvailable(false);
    }

    return (
        <button className='btn back-footer-button' onClick={handleBackClick}>
            Back
        </button>
    )
}
export const NextFooterButton = ({ stageNumber, setStageNumber, setNextButtonAvailable, nextButtonAvailable, saveButtonAvailable, userProfile }) => {

    const handleNextClick = () => {
        setStageNumber(stageNumber + 1);
        setNextButtonAvailable(false);
    }

    return (
        <button
            className={`btn next-footer-button ${!nextButtonAvailable ? 'disabled' : ''}`}
            style={{ display: !saveButtonAvailable ? 'block' : 'none' }}
            onClick={!nextButtonAvailable ? undefined : handleNextClick}
            disabled={!nextButtonAvailable}
        >
            Next
        </button>
    )
}
export const SaveFooterButton = ({ setSaveButtonAvailable, saveButtonAvailable, userProfile }) => {
    
    const [isLoading, setIsLoading] = useState(false);
    const userInfo = GetInfoFromLocalStorage();
    const userID = userInfo.userID;

    const navigate = useNavigate();

    const handleSaveClick = async (event) => {
        event.preventDefault();
        setIsLoading(true);
        const dataPayload = {
            userID,
            userProfile,
        }
        try {
            const response = await queryDatabase('/api/Profile/SaveProfileEntry.js', dataPayload); 
            const responseData = await response.json();
            if (response.ok) {
                setIsLoading(false);
                AddProfileCreatedToLocalStorage(true);
                AddProfileDataToLocalStorage(responseData.updatedProfileDocument.profiles);
                navigate('/control-centre');
            } else {
                setIsLoading(false);
                console.log('error');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    return (
        <button 
            className={`btn save-footer-button ${isLoading && 'loading'}`}
            style={{ display: saveButtonAvailable ? 'block' : 'none' }}
            onClick={handleSaveClick}
        >
            {isLoading ? (
                <LoadingDots />
            ) : (
                <p>Save Profile</p>
            )}
        </button>
    )




    const handleSaveAndExit = async (event) => {
    }

    return (
        <button 
            className={`btn save-and-exit-button ${isLoading && 'loading'}`} 
            onClick={handleSaveAndExit}
        >
            {isLoading ? (
                <LoadingDots />
            ) : (
                <p>Save and Exit</p>
            )}
        </button>
    )
}