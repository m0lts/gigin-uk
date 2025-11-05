import { post } from "@services/http";

export async function createBandProfile({ bandId, data, userId, musicianProfile }) {
  const res = await post("/bands/createBandProfile", { body: { bandId, data, userId, musicianProfile } });
  return res;
}

export async function createBandInvite({ bandId, invitedBy, invitedEmail = "" }) {
  const res = await post("/bands/createBandInvite", { body: { bandId, invitedBy, invitedEmail } });
  return res.inviteId;
}

export async function acceptBandInvite({ inviteId, musicianProfile }) {
  const res = await post("/bands/acceptBandInvite", { body: { inviteId, musicianProfile } });
  return res;
}

export async function joinBandByPassword({ bandId, musicianProfile }) {
  const res = await post("/bands/joinBandByPassword", { body: { bandId, musicianProfile } });
  return res;
}

export async function getBandByPassword({ password }) {
  const band = await post("/bands/getBandByPassword", { body: { password } });
  return band;
}

export async function leaveBand({ bandId, musicianProfileId, userId }) {
  const res = await post("/bands/leaveBand", { body: { bandId, musicianProfileId, userId } });
  return res;
}

export async function removeBandMember({ bandId, musicianProfileId, userId }) {
  const res = await post("/bands/removeBandMember", { body: { bandId, musicianProfileId, userId } });
  return res.members;
}

export async function updateBandMemberPermissions({ bandId, musicianProfileId, updates }) {
  const res = await post("/bands/updateBandMemberPermissions", { body: { bandId, musicianProfileId, updates } });
  return res.member;
}

export async function updateBandAdmin({ bandId, newAdminData, roleUpdates = {} }) {
  const res = await post("/bands/updateBandAdmin", { body: { bandId, newAdminData, roleUpdates } });
  return res.members;
}

export async function updateBandMemberImg({ musicianProfileId, pictureUrl, bands }) {
  const res = await post("/bands/updateBandMemberImg", { body: { musicianProfileId, pictureUrl, bands } });
  return res;
}

export async function deleteBand({ bandId }) {
  const res = await post("/bands/deleteBand", { body: { bandId } });
  return res;
}


