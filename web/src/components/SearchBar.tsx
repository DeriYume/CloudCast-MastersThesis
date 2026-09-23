import { useEffect, useRef, useState } from "react";
import {
  InputBase, IconButton, Box, ClickAwayListener, Slide,
} from "@mui/material";
import { Icon, Icons } from "./icons";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

export default function SearchBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("sm"));

  const onSearchPage = location.pathname === "/search";

  const [value, setValue] = useState(onSearchPage ? params.get("q") ?? "" : "");
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebouncedValue(value, 300);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setExpanded(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (onSearchPage) setValue(params.get("q") ?? "");
  }, [onSearchPage, params]);

  useEffect(() => {
    const q = debounced.trim();
    if (!q) {

      if (onSearchPage && (params.get("q") ?? "") !== "") {
        navigate("/", { replace: true });
      }
      return;
    }
    if (onSearchPage) {
      if ((params.get("q") ?? "") !== q) {
        const next = new URLSearchParams(params);
        next.set("q", q);
        navigate(`/search?${next.toString()}`, { replace: true });
      }
    } else {
      navigate(`/search?q=${encodeURIComponent(q)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  function submit() {
    const q = value.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  const field = (
    <Box
      sx={(t) => ({
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        height: 42,
        px: 1.75,
        width: { xs: 1, sm: 320, md: 460 },
        borderRadius: "8px",
        bgcolor: "background.default",
        border: "1px solid",
        borderColor: "divider",
        transition: "border-color 0.12s",
        "&:focus-within": { borderColor: t.palette.primary.main },
      })}
    >
      <Icon name={Icons.search} sx={{ color: "text.disabled" }} />
      <InputBase
        inputRef={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setValue("");
            if (!isDesktop) setExpanded(false);
          }
        }}
        placeholder="Search files and folders…"
        sx={{ flex: 1, fontSize: 14 }}
        inputProps={{ "aria-label": "search files" }}
      />
      {value && (
        <IconButton size="small" aria-label="clear search" onClick={() => { setValue(""); inputRef.current?.focus(); }}>
          <Icon name={Icons.close} />
        </IconButton>
      )}
    </Box>
  );

  if (isDesktop) return field;

  if (!expanded) {
    return (
      <IconButton
        color="inherit"
        aria-label="open search"
        onClick={() => {
          setExpanded(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        <Icon name={Icons.search} />
      </IconButton>
    );
  }

  return (
    <ClickAwayListener onClickAway={() => { if (!value) setExpanded(false); }}>
      <Slide direction="left" in={expanded} mountOnEnter unmountOnExit>
        <Box sx={{ flex: 1, mx: 1 }}>{field}</Box>
      </Slide>
    </ClickAwayListener>
  );
}
