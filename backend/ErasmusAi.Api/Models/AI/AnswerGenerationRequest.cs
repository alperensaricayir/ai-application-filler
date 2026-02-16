using System.ComponentModel.DataAnnotations;

namespace ErasmusAi.Api.Models.AI
{
    public class AnswerGenerationRequest
    {
        [Required(ErrorMessage = "CV Content is required.")]
        public string? CVContent { get; set; }

        public string? ApplicationType { get; set; }

        public string? ProgramTopic { get; set; }

        [Required(ErrorMessage = "Question is required.")]
        public string? Question { get; set; }

        public string? QuestionCategory { get; set; }
        public string? AdditionalNotes { get; set; }

        [Range(1, int.MaxValue, ErrorMessage = "Character limit must be greater than 0.")]
        public int? CharacterLimit { get; set; }

        public string? LanguageLevel { get; set; }

        public bool UseContextCache { get; set; } = false;

        public string? ModelName { get; set; }

        // New properties for Application Mode
        public string? ApplicationContent { get; set; }
        public bool IsMotivationLetter { get; set; } = false;

        public bool UseQuestionMode { get; set; } = false;

        public bool UseAdvancedFormMode { get; set; } = false;

        public bool EnableTextTrimmer { get; set; } = false;
    }
}
