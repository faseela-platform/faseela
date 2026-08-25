import { toApiMemberProfile, type ProfileRequest, type ProfileResponse } from "@faseela/api-types";
import { isProfileComplete, memberProfile, setMemberProfile } from "@faseela/db";

import { apiSessionUser, err, ok } from "@/lib/api-auth";
import { db } from "@/lib/db";

/**
 * `POST /api/v1/profile` — complete the §5 account (name + phone) from mobile.
 *
 * The counterpart to the web `/akmil-hisabak` form. The phone is stored unverified
 * (§5 defers verification); the Member id comes from the session, never the body.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const user = await apiSessionUser();
  if (!user) return err("unauthenticated", "سجّل دخولك أولاً.", 401);

  let body: ProfileRequest;
  try {
    body = (await req.json()) as ProfileRequest;
  } catch {
    return err("validation", "طلب غير صالح.", 400);
  }
  const name = (body?.name ?? "").trim();
  const phone = (body?.phone ?? "").trim();
  if (name === "" || phone === "") {
    return err("validation", "الاسم ورقم الهاتف مطلوبان.", 400);
  }

  const result = await setMemberProfile(db, user.id, { name, phoneNumber: phone });
  if (result.status === "no-such-member") {
    return err("not_found", "العضو غير موجود.", 404);
  }

  const profile = await memberProfile(db, user.id);
  return ok<ProfileResponse>({
    profile: toApiMemberProfile(profile!, isProfileComplete(profile)),
  });
}
