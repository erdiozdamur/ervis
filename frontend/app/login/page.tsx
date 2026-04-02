import { LoginForm } from '@/components/auth/login-form';
import { isGoogleConfigured } from '@/auth';

export default function LoginPage() {
  return <LoginForm showGoogle={isGoogleConfigured} />;
}
