import AppIcon from "./AppIcon";

type PageHeaderIcon =
  | "clipboard"
  | "records"
  | "share"
  | "settings"
  | "eye"
  | "arm"
  | "walk"
  | "body"
  | "face"
  | "audio"
  | "questionnaire";

export default function PageHeader({
  icon,
  title,
  description
}: {
  icon: PageHeaderIcon;
  title: string;
  description: string;
}) {
  return (
    <section className="page-header page-header-with-icon">
      <div className="page-header-title-row">
        <span className="page-header-icon">
          <AppIcon name={icon} className="page-header-icon-svg" />
        </span>
        <h1>{title}</h1>
      </div>
      <p>{description}</p>
    </section>
  );
}
