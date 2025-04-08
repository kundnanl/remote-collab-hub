import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { setMentionUsers } from "../extensions/suggestion"; 

export const useMentionUsers = () => {
  const { organization } = useOrganization();
  const [users, setUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrgUsers = async () => {
      if (!organization) return;
      try {
        const members = await organization.getMemberships();
        const names = members.data
          .map((member) => {
            const fullName =
              member.publicUserData?.firstName && member.publicUserData?.lastName
                ? `${member.publicUserData.firstName} ${member.publicUserData.lastName}`
                : member.publicUserData?.identifier;
            return fullName || null;
          })
          .filter(Boolean) as string[];

        setUsers(names);
        setMentionUsers(names); 
      } catch (err) {
        console.error("Failed to fetch org members:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrgUsers();
  }, [organization]);

  return { users, loading };
};
