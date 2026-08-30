import user from "../models/auth.js";

export const getPlans = async (req, res) => {
  try {
    const plans = [
      {
        plan: "Free",
        price: "₹0",
        limit: "1 question/day",
        description: "For users getting started with the platform.",
      },
      {
        plan: "Bronze",
        price: "₹100/month",
        limit: "5 questions/day",
        description: "For active users who ask questions regularly.",
      },
      {
        plan: "Silver",
        price: "₹300/month",
        limit: "10 questions/day",
        description: "For power users seeking daily help.",
      },
      {
        plan: "Gold",
        price: "₹1000/month",
        limit: "Unlimited questions/day",
        description: "For professionals requiring unlimited access.",
      },
    ];
    return res.status(200).json({ success: true, data: plans });
  } catch (error) {
    console.error("[subscription:controller] getPlans error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const getCurrentSubscription = async (req, res) => {
  try {
    const currentUser = await user.findById(req.userid).lean();
    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    // Return subscription object or default if not set (for existing database users)
    const subscription = currentUser.subscription || {
      plan: "Free",
      active: true,
      startDate: currentUser.joinDate || new Date(),
      endDate: null,
    };
    return res.status(200).json({ success: true, data: subscription });
  } catch (error) {
    console.error("[subscription:controller] getCurrentSubscription error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
