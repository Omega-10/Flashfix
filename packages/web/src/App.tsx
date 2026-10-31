import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import RootLayout from "@/components/layout/RootLayout";
import Story from "@/pages/Story";
import FlashfixHome from "@/pages/flashfix/FlashfixHome";
import Services from "@/pages/flashfix/Services";
import Booking from "@/pages/flashfix/Booking";
import FlashfixAbout from "@/pages/flashfix/About";
import FlashfixContact from "@/pages/flashfix/Contact";
import Profile from "@/pages/flashfix/Profile";
import Login from "@/pages/flashfix/Login";
import TrackRepair from "@/pages/flashfix/TrackRepair";
import FortixHome from "@/pages/fortix/FortixHome";
import FortixProducts from "@/pages/fortix/FortixProducts";
import FortixProductDetail from "@/pages/fortix/FortixProductDetail";
import FortixAbout from "@/pages/fortix/About";
import FortixContact from "@/pages/fortix/Contact";

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to="/flashfix" replace /> },
      { path: "story", element: <Story /> },
      // Direct root shortcuts for convenience
      { path: "login", element: <Navigate to="/flashfix/login" replace /> },
      { path: "profile", element: <Navigate to="/flashfix/profile" replace /> },
      // Flashfix routes
      { path: "flashfix", element: <FlashfixHome /> },
      { path: "flashfix/services", element: <Services /> },
      { path: "flashfix/book", element: <Booking /> },
      { path: "flashfix/login", element: <Login /> },
      { path: "flashfix/profile", element: <Profile /> },
      { path: "flashfix/track/:id", element: <TrackRepair /> },
      { path: "flashfix/about", element: <FlashfixAbout /> },
      { path: "flashfix/contact", element: <FlashfixContact /> },
      // Fortix routes
      { path: "fortix", element: <FortixHome /> },
      { path: "fortix/products", element: <FortixProducts /> },
      { path: "fortix/product/:id", element: <FortixProductDetail /> },
      { path: "fortix/about", element: <FortixAbout /> },
      { path: "fortix/contact", element: <FortixContact /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
