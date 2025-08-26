import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export const GigTemplates = ({ templates, incompleteGigs, setFormData, resetFormData, setExtraSlots }) => {

    const [selectedCard, setSelectedCard] = useState();

    const applyGigSlots = (slots) => {
        if (!slots || slots.length === 0) return;
        const [first, ...rest] = slots;
        setFormData(prev => ({
            ...prev,
            startTime: first.startTime,
            duration: first.duration,
        }));
        setExtraSlots(rest);
    };

    const handlePopulateTemplateData = (template) => {
        if (selectedCard === template.templateId) {
            resetFormData();
            setExtraSlots([]);
            setSelectedCard(undefined);
        } else {
            const { templateName, templateId, ...templateData } = template;
            const id = uuidv4();
            delete templateData.id;
            setFormData(prev => ({
                ...prev,
                ...templateData,
                gigId: id,
                id: id,
                createdAt: new Date(),
            }));
            applyGigSlots(templateData.gigSlots);
            setSelectedCard(templateId);
        }
    };

    const handlePopulateGigData = (gig) => {
        if (selectedCard === gig.gigId) {
            resetFormData();
            setExtraSlots([]);
            setSelectedCard(undefined);
        } else {
            const { gigId, createdAt, ...gigData } = gig;
            setFormData(prev => ({
                ...prev,
                ...gigData,
                gigId: gigId,
                date: gig.date.toDate(),
                createdAt: new Date(),
              }));
            applyGigSlots(gigData.gigSlots);
            setSelectedCard(gigId);
        }
    };

    const formatDate = (date) => {
        const d = date.toDate();
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes} - ${day}/${month}/${year}`;
    }

    return (
        <>  
        <div className='head'>
            <h1 className='title templates'>Use a template{incompleteGigs.length > 0 && ' or continue with a saved post'}?</h1>
        </div>
        <div className='body templates'>
            {templates.length > 0 && (
                <div className='templates-cont'>
                    <h4 style={{ paddingBottom: '10px'}}>Templates</h4>
                    <div className='selections'>
                        {templates.map((template, index) => (
                            <div className={`card template ${selectedCard === template.templateId ? 'selected' : ''}`} key={index} onClick={() => handlePopulateTemplateData(template)}>
                                <h4 className='text'>{template.templateName}</h4>
                                <p className='sub-text'>{template.venue.venueName}</p>
                                <p className='sub-text'>{formatDate(template.createdAt)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {incompleteGigs.length > 0 && (
                <div className='saved-cont'>
                    <h4 style={{ paddingBottom: '10px'}}>Saved posts</h4>
                    <div className='selections'>
                        {incompleteGigs.map((gig, index) => (
                            <div className={`card saved ${selectedCard === gig.gigId ? 'selected' : ''}`} key={index} onClick={() => handlePopulateGigData(gig)}>
                                <h4 className='text'>{gig.venue.venueName}</h4>
                                <p className='sub-text'>{formatDate(gig.createdAt)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    </>
    );
};

