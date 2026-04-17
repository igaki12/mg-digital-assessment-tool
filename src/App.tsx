import { Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Assessments from "./pages/Assessments";
import PtosisAssessment from "./pages/PtosisAssessment";
import LimbAssessment from "./pages/LimbAssessment";
import GaitAssessment from "./pages/GaitAssessment";
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
      <Route path="/" element={<Dashboard />} />
      <Route path="/assessments" element={<Assessments />} />
      <Route path="/ptosis" element={<PtosisAssessment />} />
      <Route path="/limbs" element={<LimbAssessment />} />
      <Route path="/gait" element={<GaitAssessment />} />
      <Route path="/posture" element={<PostureAssessment />} />
      <Route path="/expression" element={<ExpressionAssessment />} />
      <Route path="/voice" element={<VoiceAssessment />} />
      <Route path="/questionnaire" element={<Questionnaire />} />
      <Route path="/records" element={<Records />} />
      <Route path="/review" element={<Review />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}
