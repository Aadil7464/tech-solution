import { business, telephone } from "@/lib/business";

export default function TeamContacts({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "team-contacts compact" : "team-contacts"}>
      {business.team.map((member) => (
        <div className="team-contact" key={member.name}>
          <strong>{member.name}</strong>
          <a href={telephone(member.phone)}>{member.phone}</a>
          <p>{member.location}</p>
        </div>
      ))}
    </div>
  );
}
