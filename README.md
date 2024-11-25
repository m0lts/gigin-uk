# Gigin-UK

# Profile Creator: 
- if user hasn't made a profile, then the control centre is not visible in menu and it is replaced with a link to creating a profile
- if the user has made a profile, the profile data is sent to local storage for use
- in the control centre, if a user clicks on a previously made profile, then the userProfile state is filled with the profile data and they can go through the profile creator editing and changing this data.

# Profiles in database:
- each user has one profile document, labelled with their userID. in the document the key 'profiles' is an array and has the value of all the profiles the user has created. Each profile has a unique ID - if the user edits a profile, then the profile with the matching ID in the database gets updated.

{
    "rewrites": [
        {"source": "/(.*)", "destination": "/"}
    ]
}