const HEIGHT_KEY = "mg_user_height_cm";

export function getUserHeight() {
  const raw = localStorage.getItem(HEIGHT_KEY);
  const parsed = raw ? Number(raw) : 170;
  return Number.isFinite(parsed) ? parsed : 170;
}

export function setUserHeight(value: number) {
  localStorage.setItem(HEIGHT_KEY, String(value));
}
