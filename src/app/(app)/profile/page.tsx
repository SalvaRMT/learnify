
import { ProfileForm } from "@/components/profile/ProfileForm";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile - Learnify',
  description: 'Manage your Learnify account profile and preferences.',
};

export default function ProfilePage() {
  return (
    <div className="container mx-auto py-8">
      <ProfileForm />
    </div>
  );
}
