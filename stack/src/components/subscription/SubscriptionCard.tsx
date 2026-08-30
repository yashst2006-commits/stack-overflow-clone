import React from "react";
import { Check, Shield } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubscriptionPlan } from "@/services/subscriptionService";

interface SubscriptionCardProps {
  plan: SubscriptionPlan;
  isActive: boolean;
  onSubscribe?: (planName: string) => void;
  isSubscribing?: boolean;
  isDisabled?: boolean;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  plan,
  isActive,
  onSubscribe,
  isSubscribing = false,
  isDisabled = false,
}) => {
  // Determine if it is a premium plan for some nice visual enhancements
  const isGold = plan.plan.toLowerCase() === "gold";
  const isSilver = plan.plan.toLowerCase() === "silver";
  const isBronze = plan.plan.toLowerCase() === "bronze";

  let cardStyle = "border-gray-200 hover:shadow-md transition-all duration-300";
  let badgeText = "";
  let badgeColor = "";

  if (isActive) {
    cardStyle = "border-[#ef8236] ring-2 ring-[#ef8236]/20 shadow-md relative scale-102 transform transition-all duration-300";
    badgeText = "Active Plan";
    badgeColor = "bg-[#ef8236] text-white";
  } else if (isGold) {
    cardStyle = "border-yellow-400 hover:shadow-lg transition-all duration-300 hover:border-yellow-500";
    badgeText = "Most Popular";
    badgeColor = "bg-yellow-500 text-white";
  }

  return (
    <Card className={`flex flex-col justify-between h-full bg-white relative rounded-xl overflow-hidden ${cardStyle}`}>
      {badgeText && (
        <span className={`absolute top-3 right-3 text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${badgeColor}`}>
          {badgeText}
        </span>
      )}
      
      <CardHeader className="pb-4 pt-6">
        <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          {plan.plan}
        </CardTitle>
        <CardDescription className="text-gray-500 text-sm mt-1 min-h-[40px]">
          {plan.description}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6 py-4 flex-1">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-extrabold text-gray-900 tracking-tight">{plan.price}</span>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center text-sm text-gray-700 font-medium">
            <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
            <span>Limit: {plan.limit}</span>
          </div>
          <div className="flex items-center text-sm text-gray-500">
            <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
            <span>Access to Code-Quest Q&A</span>
          </div>
          {(isBronze || isSilver || isGold) && (
            <div className="flex items-center text-sm text-gray-500">
              <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
              <span>Priority AI responses</span>
            </div>
          )}
          {isGold && (
            <div className="flex items-center text-sm text-gray-500">
              <Shield className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0" />
              <span>Premium Developer Badge</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-4 pb-6 border-t border-gray-100 mt-auto bg-gray-50/50">
        {isActive ? (
          <Button
            variant="outline"
            className="w-full bg-green-50 hover:bg-green-50 border-green-500 text-green-700 font-semibold cursor-default hover:text-green-700"
            disabled={true}
          >
            Current Plan
          </Button>
        ) : plan.plan.toLowerCase() === "free" ? (
          <Button
            variant="outline"
            className="w-full bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed font-medium"
            disabled={true}
          >
            Default Plan
          </Button>
        ) : (
          <Button
            onClick={() => onSubscribe && onSubscribe(plan.plan)}
            disabled={isSubscribing || isDisabled}
            className="w-full bg-[#ef8236] hover:bg-[#d86d26] text-white font-semibold shadow-xs transition duration-200"
          >
            {isSubscribing ? "Processing..." : "Subscribe"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
