import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export const GigTemplates = ({ templates, incompleteGigs, setFormData }) => {

    const [selectedCard, setSelectedCard] = useState();

    const handlePopulateTemplateData = (template) => {
        const { templateName, templateId, ...templateData } = template;
        const id = uuidv4();
        setFormData({
            ...templateData,
            gigId: id,
            createdAt: new Date(),
        });
        setSelectedCard(templateId);
    };

    const handlePopulateGigData = (gig) => {
        const { gigId, createdAt, ...gigData } = gig;
        setFormData({
            ...gigData,
            gigId: gigId,
            createdAt: new Date(),
        });
        setSelectedCard(gigId);
    };

    const formatDate = (date) => {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} - ${hours}:${minutes}`;
    }

    return (
        <>  
        <div className="head">
            <h1 className="title templates">Use a template{incompleteGigs.length > 0 && ' or continue with a saved post'}?</h1>
        </div>
        <div className="body templates">
            <div className="templates-cont">
                <h2 className='subtitle'>Templates</h2>
                <div className="selections">
                    {templates.map((template, index) => (
                        <div className={`card template ${selectedCard === template.templateId ? 'selected' : ''}`} key={index} onClick={() => handlePopulateTemplateData(template)}>
                            <h4 className="text">{template.templateName}</h4>
                            <p className="sub-text">{template.venue.venueName}</p>
                        </div>
                    ))}
                </div>
            </div>
            {incompleteGigs.length > 0 && (
                <div className="saved-cont">
                    <h2 className='subtitle'>Saved posts</h2>
                    <div className="selections">
                        {incompleteGigs.map((gig, index) => (
                            <div className={`card saved ${selectedCard === gig.gigId ? 'selected' : ''}`} key={index} onClick={() => handlePopulateGigData(gig)}>
                                <h4 className="text">{gig.venue.venueName}</h4>
                                <p className="sub-text">{formatDate(gig.createdAt)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    </>
    );
};

