namespace ErasmusAi.Api.Models.AI
{
    public class FormAnalysisRequest
    {
        public required string FormText { get; set; }
    }

    public class ProjectAnalysisRequest
    {
        public required string ProjectText { get; set; }
    }

    public class FormAnalysisResponse
    {
        public string? ApplicationType { get; set; }
        public string? ProgramTopic { get; set; }
        public string? SuggestedNotes { get; set; }
    }

    public class ProjectAnalysisResponse
    {
        public string? ApplicationType { get; set; }
        public string? ProgramTopic { get; set; }
    }
}
