let profile = {
  id: 1,
  name: "Alex",
  email: "alex@example.com",
  phone: "",
  avatar: "https://i.pravatar.cc/120?img=13",
};

export async function mockGetProfile() {
  await new Promise((r) => setTimeout(r, 180));
  return profile;
}
export async function mockUpdateProfile(p) {
  await new Promise((r) => setTimeout(r, 180));
  profile = { ...profile, ...p };
  return profile;
}
export async function mockUploadAvatar(file) {
  await new Promise((r) => setTimeout(r, 180));
  profile.avatar = URL.createObjectURL(file);
  return { avatar: profile.avatar };
}
