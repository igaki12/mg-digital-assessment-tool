import { Route, Routes } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Assessments from "./pages/Assessments";
import PtosisAssessment from "./pages/PtosisAssessment";
import LimbAssessment from "./pages/LimbAssessment";
import GaitAssessment from "./pages/GaitAssessment";
import TugAssessment from "./pages/TugAssessment";
import PostureAssessment from "./pages/PostureAssessment";
import ExpressionAssessment from "./pages/ExpressionAssessment";
import VoiceAssessment from "./pages/VoiceAssessment";
import Questionnaire from "./pages/Questionnaire";
import Records from "./pages/Records";
import Review from "./pages/Review";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/assessments" element={<RequireAuth><Assessments /></RequireAuth>} />
      <Route path="/ptosis" element={<RequireAuth><PtosisAssessment /></RequireAuth>} />
      <Route path="/limbs" element={<RequireAuth><LimbAssessment /></RequireAuth>} />
      <Route path="/gait" element={<RequireAuth><GaitAssessment /></RequireAuth>} />
      <Route path="/tug" element={<RequireAuth><TugAssessment /></RequireAuth>} />
      <Route path="/posture" element={<RequireAuth><PostureAssessment /></RequireAuth>} />
      <Route path="/expression" element={<RequireAuth><ExpressionAssessment /></RequireAuth>} />
      <Route path="/voice" element={<RequireAuth><VoiceAssessment /></RequireAuth>} />
      <Route path="/questionnaire" element={<RequireAuth><Questionnaire /></RequireAuth>} />
      <Route path="/records" element={<RequireAuth><Records /></RequireAuth>} />
      <Route path="/review" element={<RequireAuth><Review /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
    </Routes>
  );
}
