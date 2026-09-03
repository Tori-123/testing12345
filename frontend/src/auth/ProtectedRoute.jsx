import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

// 路由保护 HOC：未登录访问受保护页面时重定向到 /login，
// 并把原本想去的地址存下来，登录成功后跳回去。
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 font-sans text-neutral-100">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-red-600" />
          <p className="text-sm text-neutral-500">正在加载登录状态…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
