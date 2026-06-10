import { Card } from "@heroui/react";
import { FiCheck, FiCheckCircle, FiDatabase, FiFileText } from "react-icons/fi";

interface ImportStepperProps {
  currentStep: number;
}

export default function ImportStepper({ currentStep }: ImportStepperProps) {
  const steps = [
    { id: 1, label: "Upload File", icon: FiCheckCircle },
    { id: 2, label: "Preview Data", icon: FiFileText },
    { id: 3, label: "Proses Import", icon: FiDatabase },
    { id: 4, label: "Selesai", icon: FiCheck },
  ];

  return (
    <Card className="mb-8 p-6 rounded-2xl shadow-sm border border-gray-100">
      <Card.Content className="flex-row">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          const isPending = currentStep < step.id;
          return (
            <div key={step.id} className="flex items-center w-full ">
              <div className="flex flex-col items-center gap-2 relative z-10 w-24 ">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? "bg-blue-500 text-white shadow-md shadow-blue-200"
                      : isCompleted
                        ? "bg-green-500 text-white"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  <Icon size={20} />
                </div>
                <span
                  className={`text-xs font-semibold text-center ${
                    isActive || isCompleted ? "text-gray-800" : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div className="flex-1 h-1 mx-2 rounded-full bg-gray-100 relative overflow-hidden">
                  <div
                    className={`absolute top-0 left-0 h-full transition-all duration-500 ${
                      isCompleted ? "w-full bg-green-500" : "w-0 bg-gray-100"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </Card.Content>
    </Card>
  );
}
