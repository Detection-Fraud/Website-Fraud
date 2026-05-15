"use client";

import React from "react";

import { ComplianceSummary } from "@/types/compliance.types";
import { Card, ProgressBar } from "@heroui/react";
import { LuTarget, LuUsers } from "react-icons/lu";
import { MdOutlineShowChart } from "react-icons/md";
import { TiWarningOutline } from "react-icons/ti";
import { IoTrendingDownOutline } from "react-icons/io5";

interface CardComplianceProps {
  data?: ComplianceSummary;
}
export default function CardCompliance({ data }: CardComplianceProps) {
  const totalUnit = data?.totalUnit ?? 0;
  const avgCompliance = data?.avgCompliance ?? 0;
  const unitOnTrack = data?.unitOnTrack ?? 0;
  const waspada = data?.waspada ?? 0;
  const perluPerhatian = data?.perluPerhatian ?? 0;

  const unitOnTrackPct =
    totalUnit > 0 ? Math.round((unitOnTrack / totalUnit) * 100) : 0;
  const waspadaPct =
    totalUnit > 0 ? Math.round((waspada / totalUnit) * 100) : 0;
  const perluPerhatianPct =
    totalUnit > 0 ? Math.round((perluPerhatian / totalUnit) * 100) : 0;

  type ColorProgressBar = "accent" | "warning" | "success" | "danger";

  const complianceCard: {
    title: string;
    value: number | string;
    description: string;
    haveProgressBar: boolean;
    valueProgressBar?: number;
    icon: React.ReactNode;
    style: string;
    textColor: string;
    colorProgressBar?: ColorProgressBar;
  }[] = [
    {
      title: "Total Unit",
      value: totalUnit,
      description: "unit dilaporkan",
      haveProgressBar: false,
      icon: <LuUsers />,
      style: "bg-sky-50 text-blue-800",
      textColor: "#0284c7",
    },
    {
      title: "Avg Compliance",
      value: `${avgCompliance}%`,
      description: "rata-rata seluruh unit",
      haveProgressBar: true,
      valueProgressBar: avgCompliance,
      icon: <LuTarget />,
      style: "bg-red-50 text-red-800",
      textColor: "#dc2626",
      colorProgressBar: "accent",
    },
    {
      title: "Unit On-Track",
      value: unitOnTrack,
      description: "compliance ≥ 50",
      haveProgressBar: true,
      valueProgressBar: unitOnTrackPct,
      icon: <MdOutlineShowChart />,
      style: "bg-green-50 text-green-800",
      textColor: "#16a34a",
      colorProgressBar: "success",
    },
    {
      title: "Waspada",
      value: waspada,
      description: "compliance 25-49%",
      haveProgressBar: true,
      valueProgressBar: waspadaPct,
      icon: <TiWarningOutline />,
      style: "bg-orange-50 text-orange-800",
      textColor: "text-orange-900",
      colorProgressBar: "warning",
    },
    {
      title: "Perlu Perhatian",
      value: perluPerhatian,
      description: "compliance < 25%",
      haveProgressBar: true,
      valueProgressBar: perluPerhatianPct,
      icon: <IoTrendingDownOutline />,
      style: "bg-red-50 text-red-800",
      textColor: "#dc2626",
      colorProgressBar: "danger",
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
      {complianceCard.map((item, index) => (
        <Card
          className="shadow-sm border border-gray-200 rounded-2xl"
          key={`${item.title}-${index}`}
        >
          <Card.Header className="flex flex-row justify-between items-center">
            <Card.Title className="text-xs font-bold text-gray-400">
              {item.title}
            </Card.Title>
            <div
              className={`w-8 h-8 rounded-lg ${item.style} flex items-center justify-center `}
            >
              {item.icon}
            </div>
          </Card.Header>

          <Card.Content>
            <p className={`text-3xl font-semibold text-[${item.textColor}]`}>
              {item.value}
            </p>
            <p className="text-xs text-muted">{item.description}</p>

            {item.haveProgressBar && (
              <ProgressBar
                value={item.valueProgressBar}
                color={item.colorProgressBar}
                size="sm"
              >
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
            )}
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}
