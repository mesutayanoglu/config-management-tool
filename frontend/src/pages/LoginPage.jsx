import LoginForm from '../components/Auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-md">
        <LoginForm />
      </div>
    </div>
  )
}
