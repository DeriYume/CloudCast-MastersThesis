import { Collapse, List, ListItem, ListItemIcon, ListItemText } from "@mui/material";
import { Icon, Icons } from "../../components/icons";
import { PASSWORD_RULES } from "../../utils/util";

interface Props {
  show: boolean;
  password: string;
}

export default function PasswordRules({ show, password }: Props) {
  return (
    <Collapse in={show} unmountOnExit>
      <List dense disablePadding>
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <ListItem key={rule.label} disableGutters sx={{ py: 0 }}>
              <ListItemIcon sx={{ minWidth: 30 }}>
                {ok ? (
                  <Icon name={Icons.checkCircle} sx={{ color: "success.main" }} />
                ) : (
                  <Icon name={Icons.radioUnchecked} sx={{ color: "text.disabled" }} />
                )}
              </ListItemIcon>
              <ListItemText
                primary={rule.label}
                primaryTypographyProps={{
                  variant: "body2",
                  color: ok ? "text.primary" : "text.secondary",
                }}
              />
            </ListItem>
          );
        })}
      </List>
    </Collapse>
  );
}
