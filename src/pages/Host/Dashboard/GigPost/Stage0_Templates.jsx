import { v4 as uuidv4 } from 'uuid';

export const GigTemplates = ({ templates, incompleteGigs, setFormData }) => {

    const handlePopulateTemplateData = (template) => {
        const { templateName, templateId, ...templateData } = template;
        setFormData({
            ...templateData,
            gigId: uuidv4(), // Generate a new gig ID for the new gig
            createdAt: new Date(), // Update the created date
        });
    };

    const handlePopulateGigData = (gig) => {
        const { gigId, createdAt, ...gigData } = gig;
        setFormData({
            ...gigData,
            gigId: gigId,
            createdAt: new Date(), // Update the created date
        });
    };

    return (
        <>  
        <div className="head">
            <h1 className="title">Use a template or continue?</h1>
        </div>
        <div className="body templates">
            <div className="templates-cont">
                <h2>Templates</h2>
                <div className="selections">
                    {templates.map((template, index) => (
                        <div className="card" key={index} onClick={() => handlePopulateTemplateData(template)}>
                            <h4 className="text">{template.templateName}</h4>
                            <p className="sub-text">{template.venue.venueName}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div className="saved-cont">
                <h2>Incomplete posts</h2>
                <div className="selections">
                    {incompleteGigs.map((gig, index) => (
                        <div className="card" key={index} onClick={() => handlePopulateGigData(gig)}>
                            <h4 className="text">{gig.venue.venueName}</h4>
                            <p className="sub-text">{gig.venue.address}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </>
    );
};

