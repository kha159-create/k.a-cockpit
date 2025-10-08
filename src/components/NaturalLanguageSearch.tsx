import React, { useState } from 'react';

interface NaturalLanguageSearchProps {
    onSearch: (query: string) => void;
}

const NaturalLanguageSearch: React.FC<NaturalLanguageSearchProps> = ({ onSearch }) => {
    const [query, setQuery] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        onSearch(query);
    };

    return (
        <form onSubmit={handleSubmit} className="relative w-full max-w-xs hidden md:block">
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask your AI advisor..."
                className="input w-full pr-10"
            />
            <button type="submit" className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </button>
        </form>
    );
};

export default NaturalLanguageSearch;
