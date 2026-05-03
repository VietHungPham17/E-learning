import React, { useState, useEffect, useRef } from "react";
import { getChannel, useChatContext } from "stream-chat-react";
import { SearchIcon } from "../assets";
import { ResultsDropdown } from "./";
import apiClient from "../services/apiClient";

const ChannelSearch = ({ setToggleContainer }) => {
  const { client, setActiveChannel } = useChatContext();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [teamChannels, setTeamChannels] = useState([]);
  const [directChannels, setDirectChannels] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!query) {
      setTeamChannels([]);
      setDirectChannels([]);
    }
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setShowResults(false);
        setFocusedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getChannels = async (text) => {
    try {
      setLoading(true);
      const channelResponse = client.queryChannels({
        type: "team",
        name: { $autocomplete: text },
        members: { $in: [client.userID] },
      });
      const userResponse = apiClient.get(`/api/stream-users?q=${encodeURIComponent(text)}`);

      const [channels, userRes] = await Promise.all([
        channelResponse,
        userResponse,
      ]);
      const users = userRes.data.users;

      if (channels.length) setTeamChannels(channels);
      else setTeamChannels([]);

      if (users.length) setDirectChannels(users);
      else setDirectChannels([]);

      setLoading(false);
      setShowResults(true);
    } catch (error) {
      setLoading(false);
      setQuery("");
    }
  };

  const onSearch = (event) => {
    event.preventDefault();

    const value = event.target.value;
    setQuery(value);
    setFocusedIndex(-1);

    if (value.trim()) {
      getChannels(value);
    } else {
      setShowResults(false);
      setTeamChannels([]);
      setDirectChannels([]);
    }
  };

  const onFocus = () => {
    // Khi focus vào input, nếu có text thì search và hiển thị kết quả
    if (query.trim()) {
      getChannels(query);
    }
  };

  const setChannel = (channel) => {
    setQuery("");
    setShowResults(false);
    setFocusedIndex(-1);
    setActiveChannel(channel);
  };

  // Xử lý phím mũi tên và Enter
  const handleKeyDown = (event) => {
    if (!showResults) return;

    const allResults = [...teamChannels, ...directChannels];
    const totalResults = allResults.length;

    if (totalResults === 0) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setFocusedIndex((prev) => (prev < totalResults - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        event.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        event.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < totalResults) {
          const selectedItem = allResults[focusedIndex];
          setChannel(selectedItem);
        }
        break;
      case "Escape":
        event.preventDefault();
        setShowResults(false);
        setFocusedIndex(-1);
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  return (
    <div className="channel-search__container" ref={searchContainerRef}>
      <div className="channel-search__input__wrapper">
        <div className="channel-search__input__icon">
          <SearchIcon />
        </div>
        <input
          ref={inputRef}
          className="channel-search__input__text"
          placeholder="Search"
          type="text"
          value={query}
          onChange={onSearch}
          onFocus={onFocus}
          onKeyDown={handleKeyDown}
        />
      </div>
      {query && showResults && (
        <ResultsDropdown
          teamChannels={teamChannels}
          directChannels={directChannels}
          focusedIndex={focusedIndex}
          loading={loading}
          setChannel={setChannel}
          setQuery={setQuery}
          setToggleContainer={setToggleContainer}
        />
      )}
    </div>
  );
};

export default ChannelSearch;
