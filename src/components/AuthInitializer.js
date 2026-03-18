import { useContext, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { initSocket } from "../services/socketService";

const AuthInitializer = ({ children }) => {
  const { isAuthenticated } = useContext(AuthContext);

  useEffect(() => {
    if (isAuthenticated) {
      initSocket();
    }
  }, [isAuthenticated]);

  return children;
};

export default AuthInitializer;
