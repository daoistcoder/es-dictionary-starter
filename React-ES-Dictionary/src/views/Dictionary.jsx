import React, { useRef, useState } from "react";
import axiosClient from "../axios-client.js";
import { debounce } from "lodash";
import Draggable from 'react-draggable';
import domtoimage from 'dom-to-image';
import jsPDF from 'jspdf';
import {ArrowDownTrayIcon} from "@heroicons/react/24/outline";
import {PencilSquareIcon} from "@heroicons/react/24/outline";
import {NewspaperIcon} from "@heroicons/react/24/outline";


export default function Dictionary() {
  // Popup Features
  const [showMessage, setShowMessage] = useState(false);

  const toggleMessage = () => {
    setShowMessage(!showMessage);
  };


  // Download Starts
  const divRef = useRef(null);

  const handleDownload = async () => {
    const element = divRef.current;

    const dataUrl = await domtoimage.toPng(element);

    const pdf = new jsPDF('p', 'mm', 'a4');

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imageWidth = pdfWidth * 0.8; 
    const imageHeight = (imageWidth * element.offsetHeight) / element.offsetWidth;

    const xPos = (pdfWidth - imageWidth) / 2;
    const yPos = (pdfHeight - imageHeight) / 2;

    pdf.addImage(dataUrl, 'PNG', xPos, yPos, imageWidth, imageHeight);
    pdf.save('dictionary.pdf');
  };
// Download Ends
  const [searchTerm, setSearchTerm] = useState("");
  const [searchTermHeading, setSearchTermHeading] = useState("");
  const [dictionaryData, setDictionaryData] = useState(null);
  const [searchPlaceholder, setSearchPlaceholder] = useState("Enter a word");
  const [imageData, setImageData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    console.log("handleSearch initiated");
    clearSearchTerm();

    try {
      const { data } = await axiosClient.post("/check", {
        word: searchTerm.toLowerCase(),
      });
      const response = { data };

      if (data.exists) {
        const {
          exists,
          word: {
            id,
            word: searchWord,
            image_url,
            part_of_speech,
            definition,
            pronunciation,
          },
        } = data;

        setDictionaryData({
          hwi: { hw: [pronunciation] },
          fl: [part_of_speech],
          shortdef: [definition],
        });

        setImageData(image_url);
        setSearchPlaceholder("Enter a word");
        setIsLoading(false);
        return;
      }

      const payload = await fetchData();
      // console.log(payload);
      if (!payload) {
        // console.log("POST store halted as fetchData encountered an ERROR");
        const errorMessage = `The word ${searchTerm} was invalid!`;
        setSearchPlaceholder(errorMessage);
        setDictionaryData("");
        setImageData("");
        setIsLoading(false);
        return; // Return if there is no payload detected
      } else {
        setDictionaryData({
          hwi: { hw: [payload.pronunciation] },
          fl: [payload.part_of_speech],
          shortdef: [payload.definition],
        });

        setImageData(payload.image_url);
        setSearchPlaceholder("Enter a word");
      }

      axiosClient
        .post("/store", payload)
        .then(({ word }) => {
          console.log(`You have searched the word ${word.word}!`);
        })
        .catch((err) => {
          const response = err.response;
          if (response && response.status === 404) {
            console.log("AxiosPOST Error:", response.data.errors);
          }
        });
    } catch (error) {
      if (error.response && error.response.status === 422) {
        const errorMessage = error.response.data.message;

        console.log("Validation Error:", errorMessage);
        setSearchPlaceholder(errorMessage);
        setDictionaryData("");
        setImageData("");
      } else {
        console.log("Error checking word:", error);
      }
    }
    setIsLoading(false);
  };

  const fetchData = async () => {
    const cleanedSearchTerm = searchTerm.toLowerCase();

    const UnsplashKey = "Fj2N2fNmwFAPuSC_agE73Mfy0Sv9bqtXS3XhGEcCWSY";
    const UnsplashUrl = `https://api.unsplash.com/photos/random?query=${cleanedSearchTerm}&client_id=${UnsplashKey}`;

    const MerriamWebKey = "98a198a3-a200-490a-ad48-98ac95b46d80";
    const MerriamWebUrl = `https://dictionaryapi.com/api/v3/references/collegiate/json/${cleanedSearchTerm}?key=${MerriamWebKey}`;

    try {
      const [imageResponse, dictionaryResponse] = await Promise.all([
        fetch(UnsplashUrl),
        fetch(MerriamWebUrl),
      ]);

      const imageData = await imageResponse.json();
      // console.log("imageData:", imageData);

      const dictionaryData = await dictionaryResponse.json();

      // Filter the JSON data to include only the relevant entries
      const filteredData = dictionaryData.filter(
        (entry) => entry.shortdef && entry.shortdef.length > 0
      );

      const dictionaryDataToSet =
        filteredData.length > 0 ? filteredData[0] : null;


      //prototype
      // Extract the id and remove non-letter characters
      const id = dictionaryDataToSet?.meta?.id || '';
      const cleanedKeyword = id.replace(/[^a-zA-Z]/g, '');

      console.log('cleanedKeyword:', cleanedKeyword);
      console.log('searchedKeyword:', searchTerm);

      // Create the payload using the response data
      let payload = null;

      if (imageData && imageData.urls && imageData.urls.small && cleanedKeyword === cleanedSearchTerm) {
        payload = createPayload(
          imageData.urls.small,
          dictionaryDataToSet,
          searchTerm
        );
      } else {
        console.log(`FetchData 404 Error: ${searchTerm} IS NOT FOUND`);
      }


      return payload;
    } catch (error) {
      console.log("Error fetching data:", error);
      return null;
    }
  };

  const createPayload = async (imageData, dictionaryData, searchTerm) => {
    if (!dictionaryData) {
      return null; // Return null or handle the absence of data in a desired way
    }

    const { hwi, fl, shortdef } = dictionaryData;

    const pronunciation = hwi?.hw || "";
    const part_of_speech = fl || "";
    const definition = shortdef?.[0] || "";
    const image_url = imageData;
    const word = searchTerm.toLowerCase();

    return {
      word,
      pronunciation,
      definition,
      part_of_speech,
      image_url,
    };
  };

  const debouncedSearch = debounce(async () => {
    setIsLoading(true);
    await handleSearch();
  }, 500);

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      debouncedSearch();
    }
  };

  const clearSearchTerm = () => {
    setSearchTermHeading(searchTerm);
    setSearchTerm("");
  };

  const renderDefinitions = () => {
    if (!dictionaryData) return null;

    const { hwi, fl, shortdef } = dictionaryData;

    return (
      <div className="mb-4">
        <div className="mb-2">
          <span className="bg-coffeeBrown text-black font-semibold py-1 px-2 rounded mr-2">
            {hwi && hwi.hw}
          </span>
          {fl && (
            <span className="bg-coffeeBrown text-black italic py-1 px-2 rounded mr-2">
              {fl}
            </span>
          )}
        </div>
        {shortdef && shortdef.length > 0 && <p>{shortdef[0]}</p>}
      </div>
    );
  };

  return (
    <div>
    <div className={`bg-coffee flex min-h-screen justify-center items-center ${showMessage ? "blur" : ""}`}>
      <div className="w-2/4 mx-auto min-w-full">
        <div className="max-w-md mx-auto mb-4 flex justify-evenly space-x-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isLoading ? "Loading..." : searchPlaceholder}
            className={`w-3/4 px-4 py-2 font-semibold border-2 border-coffeeBrown rounded-md focus:outline-double focus:ring-coffeeDark focus:border-coffeeDark ${isLoading
              ? "ring-coffeeDark border-coffeeDark transition ease-in-out duration-300"
              : ""
              }`}
            onKeyDown={handleKeyPress}
            disabled={isLoading}
          />

          <button
            onClick={debouncedSearch}
            disabled={isLoading}
            className={`bg-coffeeBrown text-white text-base font-semibold italic py-2 px-4 rounded shadow-sm shadow-coffeeDark hover:bg-coffeeDark focus:ring-coffeeDark w-24 ${isLoading ? "w-24 bg-coffeeDark" : ""
              }`}
          >
            {isLoading ? "Loading..." : "Search"}
          </button>
        </div>
        <div>

        {dictionaryData && imageData && (
          
          <Draggable>
           <div className="max-w-md mx-auto bg-coffeeMate rounded-lg border-4 border-solid border-coffeeBrown shadow-coffeeDark shadow-sm p-4">
           <div ref={divRef}>
            <h1 className="text-3xl text-coffeeDark font-bold italic mb-4">
              {searchTermHeading.toLowerCase()}
            </h1>
            <div className="mb-4">
              <img
                src={imageData}
                alt={searchTerm}
                className="w-full rounded object-cover border-2 border-coffeeDark transition-opacity duration-500"
                style={{
                  maxHeight: "250px",
                  minHeight: "250px",
                }}
              />
            </div>
            <div
              className="flex flex-col transition-opacity duration-500"
              style={{ maxHeight: "140px", minHeight: "140px" }}
            >
              <div className="flex-1 overflow-y-auto">
                {renderDefinitions()}
              </div>
            </div>     
            </div>
                <ArrowDownTrayIcon className="absolute bottom-5 right-5 bg-coffeeBrown text-white text-base  italic py-1 px-1 rounded shadow-sm shadow-coffeeDark hover:bg-coffeeDark focus:ring-coffeeDark h-5" onClick={handleDownload}/>
                <PencilSquareIcon className="absolute bottom-5 right-12 bg-coffeeBrown text-white text-base  italic py-1 px-1 rounded shadow-sm shadow-coffeeDark hover:bg-coffeeDark focus:ring-coffeeDark h-5" onClick={toggleMessage} />
                <NewspaperIcon className="absolute bottom-5 right-20  bg-coffeeBrown text-white text-base  italic py-1 px-1 rounded shadow-sm shadow-coffeeDark hover:bg-coffeeDark focus:ring-coffeeDark h-5" onClick={toggleMessage} />
          </div>
          </Draggable>
        )}
      </div>
      </div>
    </div>
    {showMessage && (
        <div className="popup_message">
          <p>
            In order to access the features, you need to{" "}
            <span>sign up</span>.
          </p>
          <button className="bg-coffeeBrown text-white text-base font-semibold italic py-2 px-4 rounded shadow-sm shadow-coffeeDark hover:bg-coffeeDark focus:ring-coffeeDark w-24 " onClick={toggleMessage}>Cancel</button>
        </div>
      )}
    </div>
  );
}
